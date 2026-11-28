'use strict';

/* ============================================================
   旧林游 · 乡村名片 —— 前端（桌面单页长滚动 · 只读展示版）
   已移除：登录 / 注册 / 会话 / 个人中心 / 共建提交 / 点亮乡村 /
           采纳 / 名片布局保存 等一切写操作。
   保留：静态展示 + 乡村地图 + 名片墙 + 精品线路 + 只读详情浮层。
   数据接口：GET /api/home 与 GET /api/village?id=xxx（均为只读）。
   ============================================================ */

const state = {
  home: null,
  geo: {},
  mapScope: 'china',
  filters: { province: '', tag: '', q: '' },
  village: null,
  charts: {},
};

const MODULE_LABELS_FALLBACK = {
  intro: '村情简介', history: '建村历史', culture: '民俗文化', goods: '乡村好物',
  poi: '景点与去处', route: '精品线路', honor: '荣誉与认定', person: '村庄人物',
};

/* 线路配图：按线路真实区域映射站点现有村貌照（key=route.id，纯前端，不入数据库） */
const ROUTE_MEDIA = {
  'r-xiazhuang-1d':  { card: 'tianlu-aerial.jpg',  gallery: ['xiazhuang-aerial.jpg', 'maoxianglin-visitor.jpg', 'tianlu-aerial.jpg'] },
  'r-liangdu-2d':    { card: 'yunwu-1.jpg',        gallery: ['sanxiacun-1.jpg', 'longqiao-1.jpg', 'yunwu-1.jpg'] },
  'r-liangdu-1d-a':  { card: 'sanxiacun-1.jpg',    gallery: ['xiaozhai-1.jpg', 'xinglong-1.jpg', 'sanxiacun-2.jpg'] },
  'r-liangdu-1d-b':  { card: 'longqiao-1.jpg',     gallery: ['longqiao-2.jpg', 'longqiao-3.jpg', 'longqiao-1.jpg'] },
  'r-liangdu-3d':    { card: 'yunwu-2.jpg',        gallery: ['longqiao-1.jpg', 'sanxiacun-2.jpg', 'yunwu-2.jpg'] },
  'r-liangdu-5d':    { card: 'yunwu-3.jpg',        gallery: ['ganyuan-2.jpg', 'longqiao-3.jpg', 'yunwu-3.jpg'] },
  'r-cuili-flower':  { card: 'ganyuan-1.jpg',      gallery: ['ganyuan-1.jpg', 'ganyuan-2.jpg', 'ganyuan-3.jpg'] },
  'r-cuili-pick':    { card: 'ganyuan-2.jpg',      gallery: ['ganyuan-1.jpg', 'ganyuan-2.jpg', 'ganyuan-3.jpg'] },
  'r-fengjie-1d':    { card: 'baidi-1.jpg',        gallery: ['baidi-1.jpg', 'baidi-2.jpg', 'baidi-3.jpg'] },
  'r-zhuangmei':     { card: 'santuo-1.jpg',       gallery: ['santuo-1.jpg', 'santuo-2.jpg', 'sanxiacun-1.jpg'] },
  'r-sanxiarichu':   { card: 'baidi-2.jpg',        gallery: ['baidi-2.jpg', 'baidi-3.jpg', 'baidi-1.jpg'] },
};

/* ---------- utils ---------- */

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const $toast = document.getElementById('toast');
function toast(msg, ms) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => $toast.classList.remove('show'), ms || 2600);
}

/* ============================================================
   真实村貌图片（均来自可核实的公开新闻资料，逐条标注摄影来源）
   下庄村优先：宣传毛相林与"天路"的诞生。
   ============================================================ */

const VILLAGE_MEDIA = {
  xiazhuang: {
    hero: { src: '/img/tianlu-aerial.jpg', caption: '航拍重庆巫山下庄"天路"，百余道连环弯道如玉带缠绕绝壁', source: '摄影：马佳欣 · 中国新闻网' },
    feature: {
      title: '一条天路的诞生',
      lead: '下庄四面绝壁，出山曾要翻崖走两三天。1997 年，时任村党支部书记毛相林点燃向绝壁"宣战"的开山炮，带村民用最原始的方式在悬崖上凿路。',
      steps: [
        { y: '1997', t: '向绝壁宣战', d: '毛相林带头卖牲畜凑钱，村民腰系长绳吊在几百米悬崖上打炮眼，钢钎铁锤在绝壁上凿出缺口。' },
        { y: '2004', t: '天路贯通', d: '历时 7 年、付出 6 条生命，全长 8 公里、108 道"之"字拐的出山路全线贯通，下庄到县城由 2 天缩到 1.5 小时。' },
        { y: '2021', t: '楷模荣誉', d: '带领村民筑路的毛相林被授予"全国脱贫攻坚楷模"荣誉称号，被誉为"当代愚公"。' },
        { y: '2022', t: '最美农村路', d: '下庄"天路"获评交通运输部中国"十大最美农村路"。' },
        { y: '2023', t: '村庄变景区', d: '天路下庄景区获评国家 AAAA 级旅游景区，通路后的下庄走上乡村旅游与柑橘致富路。' }
      ]
    },
    gallery: [
      { src: '/img/village-aerial.jpg', caption: '航拍重庆市巫山县竹贤乡下庄村', source: '摄影：陈媛 · 中国新闻网' },
      { src: '/img/xiazhuang-aerial.jpg', caption: '无人机航拍下庄村（2024 年 11 月）', source: '摄影：何蓬磊 · 中国新闻社' },
      { src: '/img/daxiagu-aerial.jpg', caption: '航拍重庆市巫山县下庄村大峡谷', source: '摄影：马佳欣 · 中国新闻网' },
      { src: '/img/maoxianglin-visitor.jpg', caption: '来自河北等地的游客与毛相林（中）合影', source: '摄影：何蓬磊 · 中国新闻社' },
      { src: '/img/xiazhuang-tourists.jpg', caption: '下庄村游人如织，"天路"带来乡村旅游', source: '摄影：何蓬磊 · 中国新闻社' }
    ]
  },
  baidi: {
    hero: { src: '/img/baidi-1.jpg', caption: '夔门——两岸巨崖隔水对峙，十元人民币背面取景地', source: '摄影：赤甲文旅集团 · 中国网' },
    gallery: [
      { src: '/img/baidi-2.jpg', caption: '瞿塘峡江流', source: '摄影：紫璇 · 中国网' },
      { src: '/img/baidi-3.jpg', caption: '白帝城', source: '摄影：紫璇 · 中国网' },
      { src: '/img/baidi-4.jpg', caption: '站在白帝城上望夔门', source: '摄影：赤甲文旅集团 · 中国网' }
    ]
  },
  xiaozhai: {
    hero: { src: '/img/xiaozhai-1.jpg', caption: '无人机航拍小寨天坑，世界上深度和容积最大的岩溶漏斗', source: '摄影：李相博 · 新华网' },
    gallery: [
      { src: '/img/xiaozhai-2.jpg', caption: '小寨天坑口部四面绝壁，如斧劈刀削', source: '摄影：李相博 · 新华网' },
      { src: '/img/xiaozhai-3.jpg', caption: '无人机航拍小寨天坑', source: '摄影：李相博 · 新华网' }
    ]
  },
  longqiao: {
    hero: { src: '/img/longqiao-1.jpg', caption: '无人机航拍夏日龙桥河，两岸峡谷纵深', source: '摄影：李相博 · 新华网' },
    gallery: [
      { src: '/img/longqiao-2.jpg', caption: '龙桥河天生桥', source: '摄影：李相博 · 新华网' },
      { src: '/img/longqiao-3.jpg', caption: '龙桥河沿线的天然瀑布', source: '摄影：李相博 · 新华网' }
    ]
  },
  huilong: {
    hero: { src: '/img/huilong-1.jpg', caption: '俯瞰"山门"奇观，恍若双崖倚天，万仞立劈（无人机拍摄）', source: '摄影：向进 · 新华网' },
    gallery: [
      { src: '/img/huilong-2.jpg', caption: '这处"山门"奇观与三峡夔门神似，被当地百姓称为"旱夔门"', source: '摄影：向进 · 新华网' },
      { src: '/img/huilong-3.jpg', caption: '"山门"与周边绝壁共同构成了一座巨大天坑', source: '摄影：向进 · 新华网' }
    ]
  },
  xinglong: {
    hero: { src: '/img/xinglong-1.jpg', caption: '重庆市奉节县兴隆镇航拍照片', source: '奉节县融媒体中心供图 · 新华网' },
    gallery: []
  },
  sanxiacun: {
    hero: { src: '/img/sanxiacun-1.jpg', caption: '北大校友在三峡村"北大校友林"参加义务植树活动', source: '北京大学重庆校友会供图 · 中新网重庆' },
    gallery: [
      { src: '/img/sanxiacun-2.jpg', caption: '北大校友在"北大校友林"合影', source: '北京大学重庆校友会供图 · 中新网重庆' },
      { src: '/img/sanxiacun-3.jpg', caption: '校友会负责人在三峡村植树', source: '北京大学重庆校友会供图 · 中新网重庆' }
    ]
  },
  santuo: {
    hero: { src: '/img/santuo-1.jpg', caption: '重庆市奉节县安坪镇三沱村的果园一景', source: '摄影：刘梓桐 · 新华社' },
    gallery: [
      { src: '/img/santuo-2.jpg', caption: '三沱村果农在家直播销售脐橙鲜果', source: '摄影：刘梓桐 · 新华社' }
    ]
  },
  yunwu: {
    hero: { src: '/img/yunwu-1.jpg', caption: '土家女儿会集体婚俗礼', source: '华龙网（奉节发布）' },
    gallery: [
      { src: '/img/yunwu-2.jpg', caption: '农户采收中药材', source: '华龙网（奉节发布）' },
      { src: '/img/yunwu-3.jpg', caption: '云雾乡林下大黄、白三七、淫羊藿等中药材基地', source: '华龙网（奉节发布）' }
    ]
  },
  ganyuan: {
    hero: { src: '/img/ganyuan-1.jpg', caption: '重庆巫山李花绽放', source: '摄影：何蓬磊 · 中国新闻网' },
    gallery: [
      { src: '/img/ganyuan-2.jpg', caption: '游客在曲尺乡李花丛中踏青游玩', source: '摄影：何蓬磊 · 中国新闻网' },
      { src: '/img/ganyuan-3.jpg', caption: '位于巫山县曲尺乡的三峡李院开园迎客', source: '摄影：何蓬磊 · 中国新闻网' }
    ]
  },
  zhanqi: {
    hero: { src: '/img/zhanqi-1.jpg', caption: '雪山下的战旗村', source: '摄影：孙浩（郫都区融媒体中心） · 四川新闻网' },
    gallery: [
      { src: '/img/zhanqi-2.jpg', caption: '战旗村将旧址改造为四川战旗乡村振兴培训学院', source: '摄影：陈淋 · 四川新闻网' },
      { src: '/img/zhanqi-3.jpg', caption: '战旗村利用闲置房打造的"壹里老街"小吃一条街', source: '摄影：陈淋 · 四川新闻网' }
    ]
  },
  sanhe: {
    hero: { src: '/img/sanhe-1.jpg', caption: '三河村彝家新寨整齐排列', source: '摄影：张浪 · 中国新闻网' },
    gallery: [
      { src: '/img/sanhe-2.jpg', caption: '三河村彝家新寨', source: '摄影：张浪 · 中国新闻网' },
      { src: '/img/sanhe-3.jpg', caption: '三河村彝家新寨', source: '摄影：张浪 · 中国新闻网' }
    ]
  },
  gaoqi: {
    hero: { src: '/img/gaoqi-1.jpg', caption: '航拍会同县高椅古村，三面青山环抱、一湾碧水萦绕，连片明清古建筑错落铺展', source: '摄影：杨智伟 · 湖南日报·新湖南' },
    gallery: [
      { src: '/img/gaoqi-2.jpg', caption: '航拍高椅古村，古村静谧古韵与山水灵秀尽数铺展', source: '摄影：杨智伟 · 湖南日报·新湖南' }
    ]
  },
  jiangtou: {
    hero: { src: '/img/jiangtou-1.jpg', caption: '江头村青砖灰瓦、巷道蜿蜒，村头河水流过古民居', source: '摄影：徐秀丽 · 国家文物局' },
    gallery: []
  },
  yucun: {
    hero: { src: '/img/yucun-1.jpg', caption: '浙江安吉余村，瀑布咖啡馆吸引游客', source: '摄影：孙杨洋 · 中国新闻网' },
    gallery: [
      { src: '/img/yucun-2.jpg', caption: '余村游客湖上泛舟', source: '摄影：孙杨洋 · 中国新闻网' },
      { src: '/img/yucun-3.jpg', caption: '余村游客手持咖啡拍照打卡', source: '摄影：孙杨洋 · 中国新闻网' }
    ]
  },
  xiaogang: {
    hero: { src: '/img/xiaogang-1.jpg', caption: '安徽省滁州市凤阳县小岗村（无人机照片）', source: '摄影：张端 · 新华社' },
    gallery: [
      { src: '/img/xiaogang-2.jpg', caption: '小岗村农光互补体验园（无人机照片）', source: '摄影：张端 · 新华社' }
    ]
  },
  huangcheng: {
    hero: { src: '/img/huangcheng-1.jpg', caption: '皇城相府门前', source: '摄影：张亚东 · 中国新闻网' },
    gallery: [
      { src: '/img/huangcheng-2.jpg', caption: '皇城相府"中国古堡研究基地"', source: '中国新闻网' }
    ]
  },
  gubeikou: {
    hero: { src: '/img/gubeikou-1.jpg', caption: '蟠龙山长城', source: '摄影：任思雨 · 中国新闻网' },
    gallery: [
      { src: '/img/gubeikou-2.jpg', caption: '古北口北门城楼', source: '摄影：任思雨 · 中国新闻网' }
    ]
  },
  chixi: {
    hero: { src: '/img/chixi-1.jpg', caption: '"中国扶贫第一村"赤溪村', source: '摄影：刘超超 · 中国新闻网' },
    gallery: [
      { src: '/img/chixi-2.jpg', caption: '白墙黛瓦的畲族风情购物街', source: '摄影：刘超超 · 中国新闻网' }
    ]
  }
};

function mediaOf(id) { return VILLAGE_MEDIA[id] || null; }

async function api(path) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) throw new Error((data && data.error) || ('请求失败 ' + res.status));
  return data;
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function labels() {
  return (state.home && state.home.module_labels) || MODULE_LABELS_FALLBACK;
}

function regionText(v) {
  const prov = v.province && v.province !== '重庆市' ? v.province + ' ' : '';
  return prov + v.county + (v.town ? ' · ' + v.town : '');
}

function destroyCharts() {
  Object.keys(state.charts).forEach((k) => {
    try { state.charts[k].dispose(); } catch (e) { /* ignore */ }
  });
  state.charts = {};
}

/* ---------- geo / map scope ---------- */

async function loadGeoMap(name) {
  if (state.geo[name]) return true;
  try {
    const res = await fetch('/vendor/' + name + '.json');
    const gj = await res.json();
    echarts.registerMap(name, gj);
    state.geo[name] = true;
    return true;
  } catch (e) {
    console.warn('地图数据加载失败', name, e);
    return false;
  }
}

async function loadChuanyu() { /* 已停用：川渝合并视野改为按各自省份展示 */ }

/* 地图视野：全国为固定项，其余按「有村庄的省份」动态生成（川与渝各自成省） */
const SCOPE_BASE = [
  { key: 'china', map: 'china', label: '全国', short: '全国', test: () => true }
];

const PROV_ADCODE = {
  '北京市': '110000', '天津市': '120000', '河北省': '130000', '山西省': '140000',
  '内蒙古自治区': '150000', '辽宁省': '210000', '吉林省': '220000', '黑龙江省': '230000',
  '上海市': '310000', '江苏省': '320000', '浙江省': '330000', '安徽省': '340000',
  '福建省': '350000', '江西省': '360000', '山东省': '370000', '河南省': '410000',
  '湖北省': '420000', '湖南省': '430000', '广东省': '440000', '广西壮族自治区': '450000',
  '海南省': '460000', '重庆市': '500000', '四川省': '510000', '贵州省': '520000',
  '云南省': '530000', '西藏自治区': '540000', '陕西省': '610000', '甘肃省': '620000',
  '青海省': '630000', '宁夏回族自治区': '640000', '新疆维吾尔自治区': '650000',
  '台湾省': '710000', '香港特别行政区': '810000', '澳门特别行政区': '820000'
};
const PROV_VENDOR_FILE = { '500000': 'chongqing', '510000': 'sichuan' };

function provShort(n) {
  return n.replace(/特别行政区$/, '').replace(/(维吾尔|壮族|回族)?自治区$/, '').replace(/(省|市)$/, '') || n;
}

function scopeEntries() {
  const villages = (state.home && state.home.villages) || [];
  const counts = {};
  villages.forEach((v) => { if (v.province) counts[v.province] = (counts[v.province] || 0) + 1; });
  const order = (state.home && state.home.provinces) || Object.keys(counts);
  const provs = order.filter((p) => counts[p]);
  // 重庆优先，其次四川，其余按原序
  provs.sort((a, b) => {
    const rank = (p) => (p === '重庆市' ? 0 : p === '四川省' ? 1 : 2);
    return rank(a) - rank(b);
  });
  return SCOPE_BASE.concat(provs.map((p) => {
    const code = PROV_ADCODE[p];
    return {
      key: 'prov:' + p, map: code ? 'pv-' + code : 'china', label: p, short: provShort(p),
      count: counts[p], province: p, test: (v) => v.province === p
    };
  }));
}

function scopeMeta(key) {
  return scopeEntries().find((e) => e.key === key) || SCOPE_BASE[0];
}

async function loadProvinceGeo(provName) {
  const code = PROV_ADCODE[provName];
  if (!code) return loadGeoMap('china');
  // 统一以 pv-<code> 注册，与 scopeEntries 里 map 字段保持一致（否则重庆/四川引用不到已注册底图 → 空白）
  const regName = 'pv-' + code;
  if (state.geo[regName]) return true;
  const urls = PROV_VENDOR_FILE[code]
    ? ['/vendor/' + PROV_VENDOR_FILE[code] + '.json']
    : ['/vendor/' + code + '.json', 'https://geo.datav.aliyun.com/areas_v3/bound/' + code + '_full.json'];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const gj = await res.json();
      if (!gj || !gj.features) continue;
      echarts.registerMap(regName, gj);
      state.geo[regName] = true;
      return true;
    } catch (e) { /* 换下一个来源 */ }
  }
  console.warn('省份底图加载失败', provName);
  return false;
}

async function loadScopeGeo(meta) {
  if (meta.province) return loadProvinceGeo(meta.province);
  return loadGeoMap(meta.map);
}

/* ---------- filtering ---------- */

function filteredVillages() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  return ((state.home && state.home.villages) || []).filter((v) => {
    if (f.province && (v.province || '重庆市') !== f.province) return false;
    if (f.tag && !(v.tags || []).includes(f.tag)) return false;
    if (q) {
      const hay = (v.name + ' ' + v.county + ' ' + (v.town || '') + ' ' + (v.tagline || '') + ' ' + (v.tags || []).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ============================================================
    Hero 统计
   ============================================================ */

function renderHeroStats() {
  const s = state.home.stats;
  document.getElementById('stat-villages').textContent = s.villages;
  document.getElementById('stat-counties').textContent = s.counties;
  document.getElementById('stat-pois').textContent = s.pois;
  document.getElementById('stat-routes').textContent = s.routes;
  // 供动效模块（motion.js）读取，用于统计数字滚动计数
  window.__homeStats = s;
}

/* ============================================================
    地图
   ============================================================ */

function renderMiniStrip() {
  const row = document.getElementById('mini-strip');
  if (!row) return;
  const entries = scopeEntries();
  if (!entries.some((e) => e.key === state.mapScope)) state.mapScope = 'china';
  row.innerHTML = entries.map((e, i) => `
    <button class="mini ${state.mapScope === e.key ? 'on' : ''}" data-scope="${esc(e.key)}" type="button" title="${esc(e.label)}">
      <span class="mini-map" id="mini-${i}"></span>
      <span class="mini-label">${esc(e.short)}</span>
    </button>`).join('');
  row.querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => {
    state.mapScope = b.dataset.scope;
    renderMiniStrip(); initMap();
  }));
  entries.forEach((e, i) => drawMini(e, i));
  updateStripNav();
}

/* 省份缩略条：左右滚动按钮（桌面端无横向滚轮也能划到最右） */
function stripStep() {
  const row = document.getElementById('mini-strip');
  if (!row) return 200;
  const card = row.querySelector('.mini');
  const gap = 12;
  return card ? (card.getBoundingClientRect().width + gap) * 3 : 200;
}

function scrollStrip(dir) {
  const row = document.getElementById('mini-strip');
  if (!row) return;
  row.scrollBy({ left: dir * stripStep(), behavior: 'smooth' });
}

function updateStripNav() {
  const row = document.getElementById('mini-strip');
  const prev = document.getElementById('strip-prev');
  const next = document.getElementById('strip-next');
  if (!row || !prev || !next) return;
  const max = row.scrollWidth - row.clientWidth - 1;
  prev.disabled = row.scrollLeft <= 1;
  next.disabled = row.scrollLeft >= max;
}

function setupStripNav() {
  const prev = document.getElementById('strip-prev');
  const next = document.getElementById('strip-next');
  const row = document.getElementById('mini-strip');
  if (prev) prev.addEventListener('click', () => scrollStrip(-1));
  if (next) next.addEventListener('click', () => scrollStrip(1));
  if (row) {
    row.addEventListener('scroll', updateStripNav, { passive: true });
    window.addEventListener('resize', updateStripNav);
  }
  updateStripNav();
}

async function drawMini(e, i) {
  const domId = 'mini-' + i;
  let dom = document.getElementById(domId);
  if (!dom) return;
  const ok = await loadScopeGeo(e);
  dom = document.getElementById(domId);
  if (!dom) return;
  if (!ok) { dom.classList.add('no-map'); return; }
  const ck = 'mini:' + e.key;
  if (state.charts[ck]) { try { state.charts[ck].dispose(); } catch (err) {} }
  const chart = echarts.init(dom);
  state.charts[ck] = chart;
  const dots = ((state.home && state.home.villages) || [])
    .filter(e.test)
    .filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number');
  chart.setOption({
    animation: false,
    geo: {
      map: e.map, silent: true, roam: false,
      label: { show: false },
      itemStyle: { areaColor: '#EBE4D3', borderColor: 'rgba(74,107,83,.26)', borderWidth: .6 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: '#EBE4D3' } },
      select: { label: { show: false } },
      zoom: 1.04
    },
    series: [{
      type: 'scatter', coordinateSystem: 'geo', silent: true,
      symbolSize: 3.4, itemStyle: { color: '#4A6B53' },
      data: dots.map((v) => [v.lng, v.lat])
    }]
  });
}

const _fOpen = { province: false, tag: false };

function renderFilters() {
  const h = state.home;
  const f = state.filters;
  const provEl = document.getElementById('province-filters');
  const tagEl = document.getElementById('filters');
  if (!provEl && !tagEl) return;
  const LIMIT = 8;
  const provs = ['全部'].concat(h.provinces || []);
  const tags = ['全部'].concat(h.tags || []);

  function chipBtn(name, key, val) {
    const isAll = name === '全部';
    const v = isAll ? '' : name;
    const on = (val === '') ? isAll : (v === val);
    const attr = key === 'province' ? 'data-province' : 'data-tag';
    return `<button class="chip ${on ? 'on' : ''}" ${attr}="${isAll ? '' : esc(name)}" type="button">${isAll ? '全部' : esc(name)}</button>`;
  }
  function row(label, list, key, val) {
    const head = list.slice(0, LIMIT);
    const more = list.slice(LIMIT);
    const open = _fOpen[key];
    return `
      <div class="filters">
        <span class="flabel">${label}</span>
        ${head.map((n) => chipBtn(n, key, val)).join('')}
        ${more.length ? `<button class="chips-toggle" data-key="${key}" type="button" aria-expanded="${open ? 'true' : 'false'}">${open ? '收起 ▴' : '展开 +' + more.length + ' ▾'}</button><div class="chips-more ${open ? 'open' : ''}">${more.map((n) => chipBtn(n, key, val)).join('')}</div>` : ''}
      </div>`;
  }

  if (provEl) provEl.innerHTML = row('省份', provs, 'province', f.province);
  if (tagEl) tagEl.innerHTML = row('标签', tags, 'tag', f.tag);

  [provEl, tagEl].forEach((c) => {
    if (!c) return;
    c.querySelectorAll('[data-province]').forEach((b) => b.addEventListener('click', () => {
      state.filters.province = b.dataset.province; renderFilters(); renderVList(); initMap();
    }));
    c.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
      state.filters.tag = b.dataset.tag; renderFilters(); renderVList(); initMap();
    }));
    c.querySelectorAll('.chips-toggle').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.key; _fOpen[k] = !_fOpen[k]; renderFilters();
    }));
  });
}

/* ---------- 地图配色 / 缩放控制 ---------- */

const MAP_ZOOM_MIN = 0.8;
const MAP_ZOOM_MAX = 8;
const MAP_ZOOM_FACTOR = 1.45;

// 省级填色：按收录乡村数分档，越多越深；无收录用中性纸色
const MAP_TINT_EMPTY = '#EBE4D3';
const MAP_TINT_STEPS = [
  { min: 6, color: '#7FAE77' },
  { min: 3, color: '#98C08B' },
  { min: 2, color: '#B4D0A4' },
  { min: 1, color: '#D2E2C3' }
];
function mapTint(n) {
  for (const st of MAP_TINT_STEPS) if (n >= st.min) return st.color;
  return MAP_TINT_EMPTY;
}

// 视图状态：切换底图范围时重置，同一底图重绘（筛选变化）时沿用
let mapScopeKey = null;
let mapDefaultView = { zoom: 1.05, center: null };
let mapView = null;
let mapToolsWired = false;

const mapClamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 滑杆用对数刻度：低倍率区间更细腻
function mapZoomToPct(z) {
  const t = Math.log(z / MAP_ZOOM_MIN) / Math.log(MAP_ZOOM_MAX / MAP_ZOOM_MIN);
  return Math.round(mapClamp(t, 0, 1) * 100);
}
function mapPctToZoom(p) {
  return MAP_ZOOM_MIN * Math.pow(MAP_ZOOM_MAX / MAP_ZOOM_MIN, mapClamp(p, 0, 100) / 100);
}

function currentMapGeo() {
  const inst = state.charts.map;
  if (!inst) return null;
  const opt = inst.getOption();
  return (opt && opt.geo && opt.geo[0]) || null;
}

// 同步控件：滑杆位置、百分比、两端按钮可用性
function syncMapTools() {
  const g = currentMapGeo();
  if (!g) return;
  const z = typeof g.zoom === 'number' ? g.zoom : mapDefaultView.zoom;
  const range = document.getElementById('map-zoom-range');
  const val = document.getElementById('map-zoom-val');
  const zin = document.getElementById('map-zoom-in');
  const zout = document.getElementById('map-zoom-out');
  if (range) range.value = String(mapZoomToPct(z));
  if (val) val.textContent = Math.round((z / mapDefaultView.zoom) * 100) + '%';
  if (zin) zin.disabled = z >= MAP_ZOOM_MAX - 0.001;
  if (zout) zout.disabled = z <= MAP_ZOOM_MIN + 0.001;
}

// 设定绝对缩放；center 省略则保持当前中心
function setMapZoom(z, center) {
  const inst = state.charts.map;
  if (!inst) return;
  const cur = currentMapGeo() || {};
  const next = mapClamp(z, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  const c = center !== undefined ? center : (cur.center || null);
  inst.setOption({ geo: { zoom: next, center: c } });
  mapView = { zoom: next, center: c };
  syncMapTools();
}

function resetMapView() {
  const inst = state.charts.map;
  if (!inst) return;
  inst.setOption({ geo: { zoom: mapDefaultView.zoom, center: mapDefaultView.center } });
  mapView = { zoom: mapDefaultView.zoom, center: mapDefaultView.center };
  syncMapTools();
}

// 按当前筛选（标签 / 搜索词，不含省份）统计，用于填色
function mapCounts(meta) {
  const f = state.filters;
  const q = (f.q || '').trim().toLowerCase();
  const vs = ((state.home && state.home.villages) || []).filter((v) => {
    if (f.tag && !(v.tags || []).includes(f.tag)) return false;
    if (q) {
      const hay = (v.name + ' ' + v.county + ' ' + (v.town || '') + ' ' + (v.tagline || '') + ' ' + (v.tags || []).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const counts = {};
  vs.forEach((v) => {
    const k = meta.key === 'china' ? (v.province || '重庆市') : (v.county || '');
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

const ADMIN_SUFFIX = /(市辖区|自治县|自治旗|县|区|市|旗)$/;
function normAdmin(n) { return String(n || '').replace(ADMIN_SUFFIX, ''); }

function countForRegion(name, counts) {
  if (counts[name]) return counts[name];
  const nn = normAdmin(name);
  let sum = 0;
  for (const k of Object.keys(counts)) if (normAdmin(k) === nn) sum += counts[k];
  return sum;
}

// 生成填色数据：包含 0 值区域，保证每块都有底色与 tooltip
function buildRegionData(meta, counts) {
  const mapObj = echarts.getMap(meta.map);
  const feats = (mapObj && mapObj.geoJSON && mapObj.geoJSON.features) || [];
  const activeProv = meta.key === 'china' ? (state.filters.province || '') : '';
  return feats.map((ft) => {
    const nm = (ft.properties && (ft.properties.name || ft.properties.NAME)) || '';
    const n = countForRegion(nm, counts);
    const isActive = activeProv && nm === activeProv;
    return {
      name: nm,
      value: n,
      // 颜色由 visualMap 分段映射；这里只保留名称与数值
      itemStyle: isActive ? { borderColor: 'rgba(158,59,46,.9)', borderWidth: 2 } : undefined
    };
  });
}

function wireMapTools() {
  if (mapToolsWired) return;
  mapToolsWired = true;
  const zin = document.getElementById('map-zoom-in');
  const zout = document.getElementById('map-zoom-out');
  const reset = document.getElementById('map-zoom-reset');
  const range = document.getElementById('map-zoom-range');
  if (zin) zin.addEventListener('click', () => {
    const g = currentMapGeo();
    if (g) setMapZoom((g.zoom || mapDefaultView.zoom) * MAP_ZOOM_FACTOR);
  });
  if (zout) zout.addEventListener('click', () => {
    const g = currentMapGeo();
    if (g) setMapZoom((g.zoom || mapDefaultView.zoom) / MAP_ZOOM_FACTOR);
  });
  if (reset) reset.addEventListener('click', resetMapView);
  if (range) range.addEventListener('input', () => {
    setMapZoom(mapPctToZoom(parseFloat(range.value) || 0));
  });
}

async function initMap() {
  const dom = document.getElementById('map-canvas');
  if (!dom) return;
  const meta = scopeMeta(state.mapScope);
  const ok = await loadScopeGeo(meta);
  if (!ok) {
    dom.innerHTML = '<div class="empty" style="margin:40px">地图底图加载失败，请检查网络后刷新。村庄列表不受影响。</div>';
    return;
  }
  if (state.charts.map) { try { state.charts.map.dispose(); } catch (e) {} }
  const chart = echarts.init(dom);
  state.charts.map = chart;

  // 换底图范围才重置视图；同一底图因筛选重绘时沿用当前缩放/位置
  if (mapScopeKey !== meta.key) {
    mapScopeKey = meta.key;
    mapView = null;
    mapDefaultView = {
      zoom: mapClamp(meta.zoom || 1.05, MAP_ZOOM_MIN, MAP_ZOOM_MAX),
      center: meta.center || null
    };
  }
  const view = mapView || mapDefaultView;
  const isChina = meta.key === 'china';

  const list = filteredVillages().filter(meta.test).filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number');
  const regionData = buildRegionData(meta, mapCounts(meta));

  chart.setOption({
    animation: true,
    animationDuration: 600,
    animationDurationUpdate: 260,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      trigger: 'item', confine: true,
      backgroundColor: 'rgba(28,26,22,.94)',
      borderColor: 'rgba(198,154,58,.35)', borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: '#F4F1E6', fontSize: 12.5, lineHeight: 18 },
      extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.28);max-width:260px',
      formatter: (p) => {
        if (p.seriesType === 'effectScatter' || p.seriesType === 'scatter') {
          const v = p.data.v;
          if (!v) return esc(p.name);
          return `<b style="font-size:14px">${esc(v.name)}</b><br>
            <span style="color:#B9C4B6">${esc(regionText(v))}</span><br>
            <span>${esc(v.tagline || '')}</span><br>
            <span style="color:#F4D98A;font-size:12px">点击查看名片 →</span>`;
        }
        if (p.seriesType === 'map') {
          const n = (p.data && p.data.value) || 0;
          const name = esc(p.name || '');
          if (n > 0) {
            return `<b style="font-size:14px">${name}</b><br>
              <span style="color:#C6D8BC">收录 ${n} 个乡村</span><br>
              ${isChina ? '<span style="color:#F4D98A;font-size:12px">点击筛选该省乡村 →</span>' : ''}`;
          }
          return `<b style="font-size:14px">${name}</b><br><span style="color:#B9C4B6">暂无收录</span>`;
        }
        return esc(p.name || '');
      }
    },
    geo: Object.assign({
      map: meta.map,
      roam: { scaleLimit: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX } },
      label: { show: false },
      itemStyle: {
        areaColor: MAP_TINT_EMPTY,
        borderColor: 'rgba(74,107,83,.32)',
        borderWidth: 1,
        shadowColor: 'rgba(44,42,36,.14)',
        shadowBlur: 18,
        shadowOffsetY: 7
      },
      emphasis: { label: { show: false }, itemStyle: { areaColor: '#E9E1CD' } },
      select: { disabled: true },
      zlevel: 0
    }, { zoom: view.zoom }, (view.center ? { center: view.center } : {})),
    // 填色映射：0 用纸色，1/2/3-5/≥6 四级绿，越深表示收录越多
    visualMap: {
      type: 'piecewise',
      show: false,
      seriesIndex: 0,
      pieces: [
        { min: 6, color: '#7FAE77' },
        { min: 3, max: 5, color: '#98C08B' },
        { min: 2, max: 2, color: '#B4D0A4' },
        { min: 1, max: 1, color: '#D2E2C3' },
        { value: 0, color: '#EBE4D3' }
      ]
    },
    series: [
      {
        // 填色层：用收录量表达“分布”，并承接省份悬浮/点击
        name: '收录分布',
        type: 'map',
        geoIndex: 0,
        zlevel: 1,
        data: regionData,
        label: { show: false },
        itemStyle: { areaColor: MAP_TINT_EMPTY, borderColor: 'rgba(74,107,83,.32)', borderWidth: 1 },
        emphasis: {
          label: {
            show: true, color: '#2C2A24', fontSize: 12, fontWeight: 600,
            textBorderColor: 'rgba(255,255,255,.8)', textBorderWidth: 2
          },
          itemStyle: {
            areaColor: '#F0D98F',
            borderColor: '#9E3B2E',
            borderWidth: 1.6,
            shadowColor: 'rgba(158,59,46,.35)',
            shadowBlur: 14
          }
        },
        select: { disabled: true }
      },
      {
        name: '已点亮乡村',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        rippleEffect: { brushType: 'stroke', scale: 3.4, period: 4, number: 3 },
        symbol: 'circle',
        symbolSize: 11,
        itemStyle: {
          color: '#9E3B2E',
          borderColor: 'rgba(255,250,240,.92)',
          borderWidth: 1.2,
          shadowColor: 'rgba(158,59,46,.45)',
          shadowBlur: 8
        },
        emphasis: { scale: 1.6, itemStyle: { color: '#C8553F' } },
        data: list.map((v) => ({ name: v.name, value: [v.lng, v.lat], v }))
      }
    ]
  });

  chart.off('click');
  chart.on('click', (p) => {
    if (p.data && p.data.v) { openDetail(p.data.v.id); return; }
    if (p.seriesType === 'map' && isChina) {
      const prov = p.name;
      const n = (p.data && p.data.value) || 0;
      if (!n) return;
      state.filters.province = state.filters.province === prov ? '' : prov;
      renderFilters(); renderVList(); initMap();
    }
  });

  chart.off('georoam');
  chart.on('georoam', () => {
    const g = currentMapGeo();
    if (g) mapView = { zoom: g.zoom, center: g.center || null };
    syncMapTools();
  });

  // 交互提示随底图范围变化
  const hint = document.querySelector('.map-hint span');
  if (hint) {
    hint.textContent = isChina
      ? '滚轮 / 双指缩放 · 拖动平移 · 点击省份可筛选该省乡村'
      : '滚轮 / 双指缩放 · 拖动平移 · 点击光点查看名片';
  }

  wireMapTools();
  syncMapTools();
  const tools = document.getElementById('map-tools');
  if (tools) requestAnimationFrame(() => tools.classList.add('is-ready'));
}

/* ============================================================
    名片墙
   ============================================================ */

function renderVList() {
  const el = document.getElementById('vlist');
  const count = document.getElementById('vlist-count');
  if (!el) return;
  const list = filteredVillages();
  // 下庄村作为典型案例固定排在名片墙第一位
  list.sort((a, b) => (b.id === 'xiazhuang' ? 1 : 0) - (a.id === 'xiazhuang' ? 1 : 0));
  if (count) count.textContent = '（' + list.length + ' 张）';
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="grid-column:1/-1">没有匹配的乡村，换个筛选条件试试。</div>';
    return;
  }
  el.innerHTML = list.map((v) => {
    const m = mediaOf(v.id);
    return `
    <article class="vrow ${m ? 'has-img' : ''}" data-id="${esc(v.id)}">
      ${m ? `<div class="vrow-cover" style="background-image:url('${m.hero.src}')"></div>` : ''}
      <div class="vrow-title">
        <h3>${esc(v.name)}</h3>
        <span class="vrow-region">${esc(regionText(v))}</span>
      </div>
      <p class="vrow-tag">${esc(v.tagline || v.intro || '')}</p>
      <div class="tags">${(v.tags || []).slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="vrow-foot">
        <div class="vrow-meta" style="border:none;padding:0;margin:0">
          <span><span class="lamp"></span> 去处 ${v.poi_count}</span>
          ${v.lit_at ? `<span>${fmtDate(v.lit_at)}</span>` : ''}
        </div>
        <span class="vrow-go">看名片 →</span>
      </div>
    </article>`;
  }).join('');
  el.querySelectorAll('.vrow').forEach((c) => c.addEventListener('click', () => openDetail(c.dataset.id)));
}

/* 名片墙顶部：典型案例 / 优秀名片（下庄村） */
function renderFeatured() {
  const el = document.getElementById('featured');
  if (!el) return;
  const v = ((state.home && state.home.villages) || []).find((x) => x.id === 'xiazhuang');
  const m = VILLAGE_MEDIA.xiazhuang;
  if (!v || !m) { el.style.display = 'none'; return; }
  const feats = (m.feature && m.feature.steps ? m.feature.steps.slice(0, 3) : [])
    .map((s) => `<li><b>${esc(s.y)} · ${esc(s.t)}</b><span>${esc(s.d)}</span></li>`).join('');
  el.innerHTML = `
    <div class="feat-kicker">典型案例 · 优秀名片</div>
    <div class="featured">
      <div class="featured-img" style="background-image:url('${m.hero.src}')">
        <span class="featured-src">${esc(m.hero.source)}</span>
      </div>
      <div class="featured-body">
        <h3>${esc(v.name)}</h3>
        <div class="featured-region">${esc(regionText(v))}</div>
        <p class="featured-tag">${esc(v.tagline)}</p>
        <p class="featured-intro">${esc(v.intro)}</p>
        <ul class="featured-list">${feats}</ul>
        <button class="btn btn-primary btn-sm" data-open="xiazhuang" type="button">查看完整名片</button>
      </div>
    </div>`;
  const btn = el.querySelector('[data-open]');
  if (btn) btn.addEventListener('click', () => openDetail(btn.dataset.open));
}

/* ============================================================
    精品线路
   ============================================================ */

function renderRoutes() {
  const rs = (state.home && state.home.routes) || [];
  const official = rs.filter((r) => r.provenance === '官方公开线路');
  const team = rs.filter((r) => r.provenance !== '官方公开线路');
  const count = document.getElementById('routes-count');
  const lead = document.getElementById('routes-lead');
  const body = document.getElementById('routes-body');
  if (count) count.textContent = '（' + rs.length + ' 条）';
  if (lead) lead.innerHTML = '其中 <b style="color:#F4D98A">' + official.length + ' 条</b>来自政府官网公开的线路产品，<b style="color:#F0C98A">' + team.length + ' 条</b>是团队原创设计的线路。团队原创线路中，凡未能在公开资料中找到对应记载的节点，均已逐条标注 ⚠。';
  if (!body) return;
  body.innerHTML =
    (official.length ? `<h3 class="group-title official">官方公开线路</h3>${official.map(routeCard).join('')}` : '') +
    (team.length ? `<h3 class="group-title team">团队原创设计线路</h3>${team.map(routeCard).join('')}` : '');
}

function routeCard(r) {
  const days = {};
  (r.nodes || []).forEach((n) => { (days[n.day] = days[n.day] || []).push(n); });
  const dayKeys = Object.keys(days).sort((a, b) => a - b);
  const nCount = (r.nodes || []).length;
  const detailHtml =
    dayKeys.map((dk) => `
        <div class="day-group">
          ${dayKeys.length > 1 ? `<div class="day-label">第 ${dk} 天</div>` : ''}
          <ul class="steps">
            ${days[dk].map((n) => `<li><b>${esc(n.name)}</b>${n.note ? `<span class="note ${/⚠/.test(n.note) ? 'warn' : ''}">${esc(n.note)}</span>` : ''}</li>`).join('')}
          </ul>
        </div>`).join('') +
    (r.source ? `<div class="route-src">来源：${esc(r.source)}</div>` : '');
  const media = ROUTE_MEDIA[r.id];
  return `
    <div class="route-card${media ? ' has-media' : ''}">
      <div class="rc-main">
        <div class="route-head">
          <h3>${esc(r.title)}</h3>
          <div class="route-meta">
            <span class="rm ${r.provenance === '官方公开线路' ? 'official' : 'team'}">${esc(r.provenance || '线路')}</span>
            <span class="rm">${r.days} 日游</span>
            ${r.season ? `<span class="rm">${esc(r.season)}</span>` : ''}
            ${r.region ? `<span class="rm">${esc(r.region)}</span>` : ''}
            <span class="rm">${nCount} 个节点</span>
          </div>
        </div>
        ${r.summary ? `<p>${esc(r.summary)}</p>` : ''}
        ${r.caveat ? `<div class="caveat"><b>核实边界：</b>${esc(r.caveat)}</div>` : ''}
        <div class="rc-actions">
          <button class="btn btn-primary btn-sm route-open" data-route="${esc(r.id)}" type="button">查看详情 →</button>
          <button class="route-toggle" type="button" aria-expanded="false" data-n="${nCount}">
            <span class="rt-label">展开详细行程 · ${nCount} 个节点</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
        <div class="route-detail" hidden>${detailHtml}</div>
      </div>
      ${media ? `<button class="rc-media route-open" type="button" data-route="${esc(r.id)}" aria-label="查看 ${esc(r.title)} 详情" style="background-image:url('/img/${media.card}')"></button>` : ''}
    </div>`;
}

/* 线路专属详情浮层（右侧，复用 .detail 结构） */
const $rd = document.getElementById('route-detail');
function openRouteDetail(id) {
  const r = ((state.home && state.home.routes) || []).find((x) => x.id === id);
  if (!r || !$rd) return;
  const media = ROUTE_MEDIA[id] || {};
  const days = {};
  (r.nodes || []).forEach((n) => { (days[n.day] = days[n.day] || []).push(n); });
  const dayKeys = Object.keys(days).sort((a, b) => a - b);
  const official = r.provenance === '官方公开线路';
  $rd.querySelector('.rd-hero').style.backgroundImage = media.card ? `url('/img/${media.card}')` : '';
  $rd.querySelector('.rd-title').textContent = r.title;
  $rd.querySelector('.rd-meta').innerHTML =
    `<span class="rm ${official ? 'official' : 'team'}">${esc(r.provenance || '线路')}</span>` +
    `<span class="rm">${r.days} 日游</span>` +
    (r.season ? `<span class="rm">${esc(r.season)}</span>` : '') +
    (r.region ? `<span class="rm">${esc(r.region)}</span>` : '') +
    `<span class="rm">${(r.nodes || []).length} 个节点</span>`;
  $rd.querySelector('.rd-sum').textContent = r.summary || '';
  $rd.querySelector('.rd-gal').innerHTML = (media.gallery || []).map((g) =>
    `<figure style="background-image:url('/img/${g}')" role="img" aria-label="${esc(r.title)}沿途景观"></figure>`).join('');
  $rd.querySelector('.rd-days').innerHTML = dayKeys.map((dk) =>
    `<div class="day-label">${dayKeys.length > 1 ? '第 ' + dk + ' 天' : '行程安排'}</div><ul class="steps">` +
    days[dk].map((n) => `<li><b>${esc(n.name)}</b>${n.note ? `<span class="note ${/⚠/.test(n.note) ? 'warn' : ''}">${esc(n.note)}</span>` : ''}</li>`).join('') +
    '</ul>').join('');
  $rd.querySelector('.rd-caveat').innerHTML = r.caveat ? `<div class="caveat"><b>核实边界：</b>${esc(r.caveat)}</div>` : '';
  $rd.querySelector('.rd-src').innerHTML = r.source ? '来源：' + esc(r.source) : '';
  $rd.classList.add('open');
  $rd.setAttribute('aria-hidden', 'false');
}
function closeRouteDetail() {
  if (!$rd) return;
  $rd.classList.remove('open');
  $rd.setAttribute('aria-hidden', 'true');
}

/* ============================================================
    FAQ
   ============================================================ */

const FAQ_ITEMS = [
  { q: '资料从哪里来？', a: '种子名片内容来自政府官网、地方志、党媒与公开百科，每张名片底部列出具体来源，确保可核实。' },
  { q: '为什么有些坐标是「示意位置」？', a: '除公开资料给出精确坐标的村庄外，其余坐标按所属乡镇方位估算，仅用于地图展示，不作为导航依据。' },
  { q: '为什么看不到平台经营数据？', a: '本站为演示环境，只展示可核实的乡村资料，不展示任何经营业绩数字。' },
  { q: '什么是「千村千样」？', a: '每张名片由村情简介、建村历史、民俗文化、乡村好物、景点去处、精品线路、荣誉认定等模块拼成，不同村庄可突出不同内容。' }
];

function renderFaq() {
  const el = document.getElementById('faq-list');
  if (!el) return;
  el.innerHTML = FAQ_ITEMS.map((f) => `
    <div class="faq-item"><b>${esc(f.q)}</b><p>${esc(f.a)}</p></div>`).join('');
}

/* ============================================================
    详情浮层（只读）
   ============================================================ */

const $detail = document.getElementById('detail');
const $detailBody = document.getElementById('detail-body');

async function openDetail(id) {
  $detail.classList.add('open');
  $detail.setAttribute('aria-hidden', 'false');
  $detailBody.innerHTML = '<div class="loading">加载名片中…</div>';
  document.body.style.overflow = 'hidden';
  let data;
  try { data = await api('/api/village?id=' + encodeURIComponent(id)); }
  catch (e) { $detailBody.innerHTML = '<div class="error-box">' + esc(e.message) + '</div>'; return; }
  state.village = data;
  renderDetail();
}

function closeDetail() {
  $detail.classList.remove('open');
  $detail.setAttribute('aria-hidden', 'true');
  $detailBody.innerHTML = '';
  state.village = null;
  document.body.style.overflow = '';
}

function renderDetail() {
  const d = state.village;
  const v = d.village;
  const L = labels();
  const order = (v.modules || []).filter((k) => k !== 'contribute');

  const blocks = [];
  for (const key of order) {
    if (key === 'intro' && v.intro) blocks.push(mod(L.intro, `<p>${esc(v.intro)}</p>`));
    else if (key === 'history' && v.history) blocks.push(mod(L.history, `<p>${esc(v.history)}</p>`));
    else if (key === 'culture' && v.culture) blocks.push(mod(L.culture, `<p>${esc(v.culture)}</p>`));
    else if (key === 'goods' && v.goods) blocks.push(mod(L.goods, `<p>${esc(v.goods)}</p>`));
    else if (key === 'honor' && v.honors) {
      const items = v.honors.split('｜').map((x) => x.trim()).filter(Boolean);
      blocks.push(mod(L.honor, `<ul class="honor-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`));
    } else if (key === 'poi') {
      const pois = d.pois || [];
      blocks.push(mod(L.poi + `（${pois.length}）`, pois.length ? poiFilter(pois) : '<div class="empty">暂无收录去处。</div>'));
    } else if (key === 'route') {
      const rs = d.routes || [];
      blocks.push(mod(L.route + `（${rs.length}）`, rs.length ? rs.map(routeCard).join('') : '<div class="empty">暂无经过本村的线路。</div>'));
    }
  }

  const persons = d.persons || [];
  if (persons.length) {
    blocks.push(`
      <section class="module person-mod">
        <h2>${esc(L.person || '村庄人物')}</h2>
        <div class="pm-sub">从先贤到当代乡贤，人是一座村庄最生动的名片。</div>
        <div class="timeline">
          ${persons.map((p, i) => `
            <div class="tl-item">
              <div class="tl-node ${i % 2 ? 'n2' : ''}">${esc((p.name || '·').charAt(0))}</div>
              <div class="tl-head">
                <span class="tl-name">${esc(p.name)}</span>
                ${p.era ? `<span class="tl-era">${esc(p.era)}</span>` : ''}
                ${p.kind ? `<span class="tl-kind">${esc(p.kind)}</span>` : ''}
              </div>
              ${p.title ? `<div class="tl-title">${esc(p.title)}</div>` : ''}
              ${p.bio ? `<p class="tl-bio">${esc(p.bio)}</p>` : ''}
              ${p.anecdote ? `<div class="tl-anec"><b>村志拾遗 · </b>${esc(p.anecdote)}</div>` : ''}
              ${p.source ? `<div class="tl-src">来源：${esc(p.source)}</div>` : ''}
            </div>`).join('')}
        </div>
      </section>`);
  }

  const media = mediaOf(v.id);
  const heroHtml = media ? `
    <div class="vhero-img">
      <img src="${media.hero.src}" alt="${esc(v.name)}" loading="lazy">
      <div class="vhero-cap"><span>${esc(media.hero.caption)}</span><em>${esc(media.hero.source)}</em></div>
    </div>` : '';

  const featureHtml = (media && media.feature) ? `
    <section class="module tianlu-feature">
      <h2>${esc(media.feature.title)}</h2>
      <p class="tf-lead">${esc(media.feature.lead)}</p>
      <div class="tf-steps">
        ${media.feature.steps.map((s) => `
          <div class="tf-step">
            <div class="tf-year">${esc(s.y)}</div>
            <div class="tf-body"><b>${esc(s.t)}</b><p>${esc(s.d)}</p></div>
          </div>`).join('')}
      </div>
    </section>` : '';

  const galleryHtml = (media && media.gallery && media.gallery.length) ? `
    <section class="module gallery-mod">
      <h2>真实村貌 · 影像</h2>
      <div class="gallery">
        ${media.gallery.map((g) => `
          <figure class="gitem">
            <img src="${g.src}" alt="${esc(g.caption)}" loading="lazy">
            <figcaption><span>${esc(g.caption)}</span><em>${esc(g.source)}</em></figcaption>
          </figure>`).join('')}
      </div>
    </section>` : '';

  $detailBody.innerHTML = `
    ${heroHtml}
    <section class="vhead">
      <h1>${esc(v.name)}</h1>
      <div class="vregion">${esc(v.province)} ${esc(v.county)}${v.town ? ' ' + esc(v.town) : ''}
        ${typeof v.lat === 'number' ? ' · ' + v.lat.toFixed(4) + '°N, ' + v.lng.toFixed(4) + '°E' + (v.coord_note === 'exact' ? '（公开资料精确坐标）' : '（示意坐标）') : ''}</div>
      ${v.tagline ? `<p class="vtagline">${esc(v.tagline)}</p>` : ''}
      <div class="tags">${(v.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div style="margin-top:16px">
        <button class="btn btn-ghost btn-sm" id="btn-share" type="button">分享名片链接</button>
      </div>
    </section>
    ${galleryHtml}
    ${featureHtml}
    ${blocks.join('')}
    ${v.sources ? `<div class="source-box"><b>资料来源</b><br>${esc(v.sources)}${media ? '<br>图片均来自上述公开新闻资料，摄影署名见各图说明。' : ''}</div>` : ''}
  `;

  bindPoiTabs($detailBody);
  const share = document.getElementById('btn-share');
  if (share) share.addEventListener('click', async () => {
    const url = location.origin + '/#/v/' + encodeURIComponent(v.id);
    try { await navigator.clipboard.writeText(url); toast('名片链接已复制'); }
    catch (e) { toast('请手动复制：' + url, 5000); }
  });
}

function mod(title, inner) {
  return `<section class="module"><h2>${esc(title)}</h2>${inner}</section>`;
}

/* 景点与去处：分类标签栏（全部 / 景点 / 露营 / 研学 …），可预览全部或点标签看专项 */
function poiFilter(pois) {
  const kinds = [];
  const counts = {};
  pois.forEach((p) => {
    const k = p.kind || '其他';
    if (!counts[k]) { counts[k] = 0; kinds.push(k); }
    counts[k]++;
  });
  const tabs = `<div class="poi-tabs">
    <button class="poi-tab on" data-f="" type="button">全部 <i>${pois.length}</i></button>
    ${kinds.map((k) => `<button class="poi-tab" data-f="${esc(k)}" type="button">${esc(k)} <i>${counts[k]}</i></button>`).join('')}
  </div>`;
  const list = `<div class="poi-list poi-filter-list">
    ${pois.map((p) => `
      <div class="poi" data-kind="${esc(p.kind || '其他')}">
        <h4>${esc(p.name)}
          ${p.kind ? `<span class="poi-kind">${esc(p.kind)}</span>` : ''}
          ${p.grade ? `<span class="poi-grade">${esc(p.grade)}</span>` : ''}
        </h4>
        ${p.descr ? `<p>${esc(p.descr)}</p>` : ''}
      </div>`).join('')}
  </div>`;
  return tabs + list;
}

function bindPoiTabs(root) {
  root.querySelectorAll('.poi-tabs').forEach((bar) => {
    const tabs = bar.querySelectorAll('.poi-tab');
    const list = bar.parentElement.querySelector('.poi-filter-list');
    if (!list) return;
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('on'));
      t.classList.add('on');
      const f = t.dataset.f;
      list.querySelectorAll('.poi').forEach((item) => {
        item.style.display = (!f || item.dataset.kind === f) ? '' : 'none';
      });
    }));
  });
}

/* ---------- overlay close handlers ---------- */
$detail.addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-close')) closeDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $detail.classList.contains('open')) closeDetail();
});

/* ============================================================
    导航高亮 + 路由
   ============================================================ */

const NAV_LINKS = ['map', 'villages', 'routes', 'local', 'about'];

function markActive(link) {
  // 桌面横向导航与移动端抽屉两处都要同步高亮
  document.querySelectorAll('.nav-links-desktop a, .nav-drawer a').forEach((a) => {
    a.classList.toggle('active', a.dataset.link === link);
  });
}

function setupScrollSpy() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) markActive(en.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  NAV_LINKS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

function handleHash() {
  const hash = location.hash.replace(/^#/, '') || '/';
  if (hash.indexOf('/v/') === 0) {
    openDetail(decodeURIComponent(hash.slice(3)));
  } else if (hash === '/' || hash === '') {
    // 回到顶部首页
  }
}

window.addEventListener('hashchange', handleHash);
window.addEventListener('resize', () => {
  Object.keys(state.charts).forEach((k) => { try { state.charts[k].resize(); } catch (e) {} });
  // 视口变宽时收起移动端菜单，避免残留遮罩
  if (window.innerWidth > 920 && $navDrawer && $navDrawer.classList.contains('open')) {
    closeMobileNav(false);
  }
});

/* ============================================================
    移动端导航（抽屉菜单）
    ============================================================ */

const $navToggle = document.getElementById('nav-toggle');
const $navDrawer = document.getElementById('nav-links');
const $navBackdrop = document.getElementById('nav-backdrop');
const $navDrawerClose = document.getElementById('nav-drawer-close');
const MOBILE_NAV_BP = 920;
let closeTimer = null;

function isMobileNav() {
  return window.innerWidth <= MOBILE_NAV_BP;
}

function openMobileNav() {
  if (!$navToggle || !$navDrawer) return;
  $navDrawer.hidden = false;
  // 强制一次 reflow，保证从 translateX(100%) 的初值开始过渡
  void $navDrawer.offsetWidth;
  $navDrawer.classList.add('open');
  $navToggle.setAttribute('aria-expanded', 'true');
  $navToggle.setAttribute('aria-label', '关闭导航菜单');
  document.body.classList.add('nav-open');
  if ($navBackdrop) $navBackdrop.hidden = false;
  // 焦点移入菜单，便于键盘与读屏用户继续操作
  const first = $navDrawer.querySelector('a');
  if (first) first.focus();
}

function closeMobileNav(returnFocus) {
  if (!$navToggle || !$navDrawer) return;
  $navDrawer.classList.remove('open');
  $navToggle.setAttribute('aria-expanded', 'false');
  $navToggle.setAttribute('aria-label', '打开导航菜单');
  document.body.classList.remove('nav-open');
  if ($navBackdrop) $navBackdrop.hidden = true;
  // 等滑出动画结束再隐藏，避免菜单瞬间消失
  if (returnFocus && $navToggle) $navToggle.focus();
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!$navDrawer.classList.contains('open')) $navDrawer.hidden = true;
  }, 300);
}

function toggleMobileNav() {
  if (!$navDrawer) return;
  if ($navDrawer.classList.contains('open')) closeMobileNav(false);
  else openMobileNav();
}

if ($navToggle) {
  $navToggle.addEventListener('click', toggleMobileNav);
}
if ($navDrawerClose) {
  $navDrawerClose.addEventListener('click', () => closeMobileNav(true));
}
if ($navBackdrop) {
  $navBackdrop.addEventListener('click', () => closeMobileNav(false));
}
if ($navDrawer) {
  // 点击菜单项后收起，并交还焦点给触发按钮
  $navDrawer.addEventListener('click', (e) => {
    if (e.target.closest('a') && isMobileNav()) {
      closeMobileNav(false);
    }
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $navDrawer && $navDrawer.classList.contains('open')) {
    closeMobileNav(true);
  }
});

/* ============================================================
    boot
   ============================================================ */

const $gq = document.getElementById('global-q');
function runSearch(scroll) {
  state.filters.q = $gq.value;
  renderVList(); initMap();
  if (scroll && $gq.value.trim()) {
    const sec = document.getElementById('villages');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
$gq.addEventListener('input', () => runSearch(true));
$gq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(true); } });
document.addEventListener('keydown', (e) => {
  // 在别处按 / 聚焦搜索
  if (e.key === '/' && document.activeElement !== $gq && !$detail.classList.contains('open')) {
    e.preventDefault(); $gq.focus();
  }
});

// 线路卡片「展开 / 收起详细行程」——事件委托，单次绑定
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.route-toggle');
  if (!btn) return;
  const card = btn.closest('.route-card');
  const detail = card && card.querySelector('.route-detail');
  if (!detail) return;
  const lbl = btn.querySelector('.rt-label');
  if (detail.hasAttribute('hidden')) {
    detail.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    if (lbl) lbl.textContent = '收起详细行程';
  } else {
    detail.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
    if (lbl) lbl.textContent = '展开详细行程 · ' + btn.dataset.n + ' 个节点';
  }
});

// 线路「查看详情」→ 右侧专属详情浮层
document.addEventListener('click', (e) => {
  const b = e.target.closest('.route-open');
  if (b && b.dataset.route) { openRouteDetail(b.dataset.route); }
});
if ($rd) {
  $rd.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeRouteDetail));
}

(async function boot() {
  try {
    state.home = await api('/api/home');
  } catch (e) {
    document.getElementById('hero-stats').innerHTML = '<div class="error-box">数据加载失败：' + esc(e.message) + '</div>';
    return;
  }
  renderHeroStats();
  renderMiniStrip();
  setupStripNav();
  renderFilters();
  await initMap();
  renderFeatured();
  renderVList();
  renderRoutes();
  renderFaq();
  setupScrollSpy();
  handleHash();
})();
