'use strict';

/* ============================================================
   旧林游 · 乡村名片 —— 服务端（只读展示版）
   本版本已移除登录 / 注册 / 会话 以及共建提交、点亮乡村等一切写操作，
   仅保留：静态资源托管 + /api/home + /api/village 两个只读接口。
   数据仍来自内置 Supabase（PostgREST），种子数据首次访问时幂等补种。
   ============================================================ */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { villages: SEED_VILLAGES, MODULE_LABELS } = require('./data-villages.js');
const { routes: SEED_ROUTES } = require('./data-routes.js');

// 把种子里所有村庄的人物拉平，用于人物表幂等补种
const SEED_PERSONS = [];
for (const v of SEED_VILLAGES) {
  for (const p of (v.persons || [])) {
    SEED_PERSONS.push({
      id: p.id, village_id: v.id, name: p.name,
      era: p.era || null, kind: p.kind || null, title: p.title || null,
      bio: p.bio || null, anecdote: p.anecdote || null,
      source: p.source || null, sort: p.sort || 0
    });
  }
}

const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY;

const DEFAULT_MODULES = ['intro', 'history', 'culture', 'goods', 'poi', 'route', 'honor'];

// ---------- Supabase REST helpers ----------

function sbHeaders(extra) {
  return Object.assign({
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

async function sb(table, query, options) {
  const url = SB_URL + '/rest/v1/' + table + (query ? '?' + query : '');
  const res = await fetch(url, Object.assign({ headers: sbHeaders() }, options || {}));
  const text = await res.text();
  if (!res.ok) {
    throw new Error('Supabase ' + res.status + ' on ' + table + ': ' + text.slice(0, 400));
  }
  return text ? JSON.parse(text) : [];
}

// ---------- Seeding (idempotent) ----------

let seedPromise = null;

function ensureSeed() {
  if (!seedPromise) seedPromise = doSeed().catch((err) => { seedPromise = null; throw err; });
  return seedPromise;
}

async function doSeed() {
  // 人物表独立幂等补种
  try {
    const pc = await sb('person', 'select=id&limit=500');
    if (SEED_PERSONS.length && pc.length < SEED_PERSONS.length) {
      await sb('person', '', { method: 'POST', headers: sbHeaders({ 'Prefer': 'resolution=ignore-duplicates' }), body: JSON.stringify(SEED_PERSONS) });
      console.log('[seed] persons', SEED_PERSONS.length);
    }
  } catch (e) { console.error('[seed] person failed', e.message); }

  const existing = await sb('village', 'select=id&limit=500');
  if (existing.length >= SEED_VILLAGES.length) return;

  // 注意：批量 POST 要求数组内每个对象的键集合完全一致（PostgREST PGRST102），
  // 因此所有可缺省字段必须显式归一为 null/默认值，不能留 undefined 被 JSON.stringify 丢键。
  const villageRows = SEED_VILLAGES.map((v) => ({
    id: v.id,
    name: v.name,
    province: v.province || '重庆市',
    county: v.county,
    town: v.town || null,
    tagline: v.tagline || null,
    tags: v.tags || [],
    lat: typeof v.lat === 'number' ? v.lat : null,
    lng: typeof v.lng === 'number' ? v.lng : null,
    coord_note: v.coord_note || 'approx',
    intro: v.intro || null,
    history: v.history || null,
    culture: v.culture || null,
    goods: v.goods || null,
    honors: v.honors || null,
    sources: v.sources || null,
    modules: v.modules || DEFAULT_MODULES,
    is_seed: true,
    created_by: '旧林游资料组'
  }));

  const poiRows = [];
  for (const v of SEED_VILLAGES) {
    for (const p of (v.pois || [])) {
      poiRows.push({
        id: p.id,
        village_id: v.id,
        name: p.name,
        kind: p.kind || '景点',
        descr: p.descr || null,
        grade: p.grade || null,
        sort: p.sort || 0
      });
    }
  }

  const routeRows = SEED_ROUTES.map((r) => ({
    id: r.id,
    title: r.title,
    region: r.region || null,
    days: r.days || 1,
    season: r.season || null,
    summary: r.summary || null,
    nodes: r.nodes || [],
    source: r.source || null,
    provenance: r.provenance || null,
    caveat: r.caveat || null,
    sort: r.sort || 0
  }));

  await sb('village', '', { method: 'POST', headers: sbHeaders({ 'Prefer': 'resolution=ignore-duplicates' }), body: JSON.stringify(villageRows) });
  await sb('poi', '', { method: 'POST', headers: sbHeaders({ 'Prefer': 'resolution=ignore-duplicates' }), body: JSON.stringify(poiRows) });
  await sb('route', '', { method: 'POST', headers: sbHeaders({ 'Prefer': 'resolution=ignore-duplicates' }), body: JSON.stringify(routeRows) });

  console.log('[seed] inserted', villageRows.length, 'villages,', poiRows.length, 'pois,', routeRows.length, 'routes');
}

// ---------- Data assembly ----------

const VILLAGE_LIST_FIELDS = 'id,name,province,county,town,tagline,tags,lat,lng,coord_note,lit_at,created_by,is_seed,modules';

async function buildHome() {
  const [villages, routes, pois] = await Promise.all([
    sb('village', 'select=' + encodeURIComponent(VILLAGE_LIST_FIELDS) + '&order=lit_at.asc,id.asc'),
    sb('route', 'select=id,title,region,days,season,summary,nodes,provenance,caveat,source,sort&order=sort.asc'),
    sb('poi', 'select=village_id&limit=5000')
  ]);

  const poiCount = {};
  for (const p of pois) poiCount[p.village_id] = (poiCount[p.village_id] || 0) + 1;

  const list = villages.map((v) => Object.assign({}, v, { poi_count: poiCount[v.id] || 0 }));

  const counties = Array.from(new Set(list.map((v) => v.county))).sort();
  const provinces = Array.from(new Set(list.map((v) => v.province || '重庆市'))).sort();
  const tags = Array.from(new Set(list.flatMap((v) => v.tags || []))).sort();

  return {
    stats: {
      villages: list.length,
      counties: counties.length,
      pois: pois.length,
      routes: routes.length
    },
    counties,
    provinces,
    tags,
    villages: list,
    routes: routes.map((r) => Object.assign({}, r, { provenance: r.provenance || null })),
    module_labels: MODULE_LABELS
  };
}

async function buildVillage(id) {
  const villages = await sb('village', 'select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
  if (villages.length === 0) return null;
  const [pois, relatedRoutes, persons] = await Promise.all([
    sb('poi', 'select=*&village_id=eq.' + encodeURIComponent(id) + '&order=sort.asc'),
    sb('route', 'select=*&order=sort.asc'),
    sb('person', 'select=*&village_id=eq.' + encodeURIComponent(id) + '&order=sort.asc').catch(() => [])
  ]);

  const village = villages[0];
  const county = village.county;
  const town = village.town;
  const matched = relatedRoutes.filter((r) => {
    const hay = ((r.region || '') + ' ' + (r.title || '') + ' ' + (r.summary || ''));
    return (town && hay.includes(town)) || (county && hay.includes(county)) || hay.includes(village.name);
  });

  return {
    village: Object.assign({}, village, { modules: village.modules && village.modules.length ? village.modules : DEFAULT_MODULES }),
    pois,
    routes: matched,
    persons,
    module_labels: MODULE_LABELS
  };
}

// ---------- HTTP ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { sendText(res, 403, 'forbidden'); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // 单页应用回退到 index.html
      const index = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(index, (e2, buf) => {
        if (e2) { sendText(res, 404, 'not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // 入口与主逻辑文件不缓存，保证每次发版即时生效；vendor/geoJSON 等大文件仍长缓存
    const isVolatile = ext === '.html' || ext === '.css' || rel === '/app.js';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': isVolatile ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  try {
    if (!p.startsWith('/api/')) { serveStatic(res, p); return; }

    if (!SB_URL || !SB_KEY) { sendJSON(res, 500, { error: '数据库未就绪' }); return; }

    await ensureSeed();

    // GET /api/home
    if (req.method === 'GET' && p === '/api/home') {
      sendJSON(res, 200, await buildHome());
      return;
    }

    // GET /api/village?id=xxx
    if (req.method === 'GET' && p === '/api/village') {
      const id = (u.searchParams.get('id') || '').trim().slice(0, 80);
      if (!id) { sendJSON(res, 400, { error: '缺少 id' }); return; }
      const data = await buildVillage(id);
      if (!data) { sendJSON(res, 404, { error: '未找到该乡村名片' }); return; }
      sendJSON(res, 200, data);
      return;
    }

    sendJSON(res, 404, { error: 'no such endpoint' });
  } catch (err) {
    console.error('[api]', p, err && err.message);
    sendJSON(res, 500, { error: (err && err.message) || 'server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('旧林游·乡村名片 listening on ' + HOST + ':' + PORT);
});
