# Homewood · 旧林游乡村名片

> **JiuLinYou — every village, a calling card.**
> 村村有名片，千村千样。创新乡村旅游**兴模式**，建设乡村名片**新工具**。

![node](https://img.shields.io/badge/node-%E2%89%A5%2022-3c873f)
![deps](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![stack](https://img.shields.io/badge/stack-node%20·%20vanilla%20js%20·%20echarts-4a6b53)
![status](https://img.shields.io/badge/status-live%20demo-yellow)

**Live demo（在线演示）:** <https://vbgqhm56.qwenwork.host/>

Homewood (旧林游) turns every Chinese village into a shareable **digital calling card** — its profile, founding history, folk culture, local produce, scenic spots and curated travel routes, brought online so people who left for the city can record their hometown and find their way back. Rooted in the Sichuan–Chongqing region, reaching across China.

> *“A caged bird longs for the old woods; a pond fish yearns for the deep pool it came from.”*
> —— 陶渊明《归园田居》「羁鸟恋旧林，池鱼思故渊」

中文简介：许多从乡村走出来的人，在城市待久了，反而想念山野的清风与故土的炊烟。旧林游把乡村的村情简介、建村历史、民俗文化、乡村好物、景点去处与精品线路搬到线上，做成一张能被看见、被转发的**数字名片**——你也可以用它记录家乡、点亮属于自己的乡村名片。

---

## Highlights · 功能特性

- **乡村地图 / Interactive map** — ECharts province map; filter by province and theme tags; click any marker to open that village's card.
- **乡村名片墙 / Village cards** — one personalized digital card per village (profile · history · culture · produce · spots · honors · notable people), with global search.
- **精品线路 / Curated routes** — official and team-designed itineraries; card imagery, expandable day-by-day plans, and a dedicated route detail panel.
- **乡村土著 / Local companions** — the "local companion / rural revitalization manager" service model and its enablement pipeline.
- **Craft & care** — 国风 (Chinese literati) visual system, per-module photographic parallax backdrops, and accessibility (visible focus rings, skip link, `prefers-reduced-motion`).

## Tech stack · 技术栈

| Layer | Choice |
|---|---|
| Backend | Node.js built-in `http` only — **zero runtime dependencies** |
| Frontend | Vanilla HTML / CSS / JS single-page app (hash routing) |
| Visualization | Bundled [Apache ECharts](https://echarts.apache.org/) + offline map GeoJSON |
| Data | Managed Postgres via PostgREST (Supabase), seeded idempotently from local files |

## How it works · 运行原理

```
data-villages.js / data-routes.js   (local seed)
        │  first /api request → idempotent seeding
        ▼
     server.js  ──►  PostgREST (Supabase: village · poi · route · person)
        │  GET /api/home · GET /api/village?id=
        ▼
   public/app.js  ──►  renders map / cards / routes / detail overlays
```

`server.js` serves `public/` statically, exposes two **read-only** endpoints, and on first data request backfills any missing seed rows. Authentication, submission and "light-up" write operations are intentionally removed in this demo build.

## Project structure · 目录结构

```
.
├── server.js            # entrypoint: static hosting + read-only API + idempotent seeding
├── package.json         # name=homewood · type=commonjs · main=server.js · engines node>=22 · no deps
├── data-villages.js     # village seed data (profile/history/culture/produce/spots/honors/people + sources)
├── data-routes.js       # curated route seed data (day nodes / provenance / caveat / source)
├── README.md
├── .gitignore
└── public/              # frontend assets served by server.js
    ├── index.html       # SPA shell
    ├── app.js           # all client logic (map, cards, routes, detail overlays, search)
    ├── style.css        # design tokens + 国风 styling + module backdrops + a11y
    ├── vendor/          # echarts.min.js + map GeoJSON (china / chongqing / sichuan / provinces)
    └── img/             # village photos, module backdrops, logo
```

## Getting started · 快速开始

Requires **Node.js ≥ 22**. No install step is needed (no dependencies).

```bash
# run locally
npm start            # same as: node server.js
# open http://localhost:8081
```

Static pages and all client logic run without a database. The `/api/*` data endpoints require the environment variables below; otherwise they return `数据库未就绪`.

### Environment variables · 环境变量

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8081` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `SUPABASE_URL` | — | PostgREST root URL (without `/rest/v1`) |
| `SUPABASE_ANON_KEY` | — | Supabase anon key |

### API · 接口

| Method & path | Description |
|---|---|
| `GET /api/home` | Aggregate home data: stats · provinces · tags · village list · routes |
| `GET /api/village?id=<id>` | One village card: detail · POIs · matched routes · notable people |

### Data model · 数据表

`village` · `poi` · `route` · `person` — created and backfilled from `data-*.js` on first data request (insert is idempotent; existing rows are skipped).

## Deployment · 部署（QW Pages）

Published as a dynamic Node page: `category=dynamic`, `entrypoint=server.js`, `port=8081`, with the managed database enabled. A database-backed QW Page is pinned to the session that created it — re-publishing in that session bumps the version on the same domain; a new session must provision a fresh database and gets a new domain.

## Data sources & disclaimer · 数据来源与免责声明

- All village material is drawn from government websites, local gazetteers, official media and public encyclopedias; each card cites its sources.
- Village coordinates are **indicative positions** unless otherwise noted — for map display only, not navigation.
- This is a demonstration prototype and **displays no platform business-performance data**.
- Decorative scenery/brand images are illustrative; replace with properly licensed, attributable photos before public release.

## License

Currently a private demo project (`package.json` → `private: true`). To open-source it, add a `LICENSE` and confirm the rights for all bundled images, fonts and third-party data.
