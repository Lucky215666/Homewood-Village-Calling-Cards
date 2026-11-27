/* ============================================================
    旧林游 · 动效模块（GSAP）
    只负责视觉动效，不改变任何业务逻辑与数据流。

    设计原则：
    1. 气质克制 —— 国风页面用干脆的减速曲线（power2.out / power3.out），
       不使用回弹（back / elastic / bounce），避免廉价感。
    2. 只动 transform / opacity —— 不触发布局重排，保证滚动流畅。
    3. 尊重 prefers-reduced-motion —— 系统开启「减少动态效果」时
       全部动效关闭，内容直接呈现，不做半吊子的降级。
    4. 渐进增强 —— GSAP 未加载成功时静默降级，页面照常可用。
   ============================================================ */

import { gsap, ScrollTrigger } from '/vendor/gsap-esm.js';

/* ---------- 基础设置 ---------- */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 全站默认缓动：干脆的减速，不回弹（back/elastic/bounce 会让国风页面显廉价）
gsap.defaults({ ease: 'power2.out', duration: 0.8 });

if (REDUCED) {
  // 减少动态效果：清掉所有可能的位移动画，内容直接呈现
  gsap.set('*', { clearProps: 'transform,opacity,visibility' });
}

/* ---------- 工具函数 ---------- */

const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

/** 数字滚动计数：把 el 的文本从 0 递增到目标值 */
function countUp(el, target, opts) {
  const o = opts || {};
  if (REDUCED) { el.textContent = String(target); return; }
  const obj = { v: 0 };
  el.textContent = '0';
  gsap.to(obj, {
    v: target,
    duration: o.duration || 1.6,
    ease: 'power2.out',
    delay: o.delay || 0,
    onUpdate() { el.textContent = String(Math.round(obj.v)); },
    onComplete() { el.textContent = String(target); }
  });
}

/* ============================================================
    1. Hero —— 首屏入场
   ============================================================ */

function animateHero() {
  if (REDUCED) return;

  const tl = gsap.timeline({ delay: 0.15 });

  // kicker：字距展开 + 淡入
  tl.from('.hero .kicker', {
    opacity: 0,
    letterSpacing: '12px',
    duration: 1,
    ease: 'power2.out'
  }, 0);

  // 主标题：整块上浮
  tl.from('.hero-title', {
    opacity: 0,
    y: 34,
    duration: 1.1,
    ease: 'power3.out'
  }, 0.08);

  // 标语：左侧金色竖线先长出来，再出文字
  tl.from('.hero-slogan', {
    opacity: 0,
    y: 18,
    duration: 0.9
  }, 0.24);

  // 副文案
  tl.from('.hero-sub', {
    opacity: 0,
    y: 18,
    duration: 0.9
  }, 0.34);

  // 统计卡片：依次浮起
  tl.from('.stat', {
    opacity: 0,
    y: 26,
    scale: 0.96,
    duration: 0.9,
    stagger: 0.1
  }, 0.42);

  // 首屏背景的呼吸式缩放（Ken Burns）由 CSS 关键帧实现：
  // .hero::before 是伪元素，GSAP 无法直接定位它。
}

/* ---------- 1b. Hero 统计数字滚动 ---------- */

function animateHeroStats() {
  const map = [
    ['stat-villages', 'villages'],
    ['stat-counties', 'counties'],
    ['stat-pois', 'pois'],
    ['stat-routes', 'routes']
  ];
  const stats = (window.__homeStats || null);
  map.forEach((pair, i) => {
    const el = document.getElementById(pair[0]);
    if (!el) return;
    const target = stats ? stats[pair[1]] : parseInt(el.textContent, 10);
    if (isNaN(target)) return;
    countUp(el, target, { delay: 0.55 + i * 0.12, duration: 1.5 });
  });
}

/* ============================================================
    2. 区块标题揭示（滚动进入视口）
   ============================================================ */

function animateSectionHeadings() {
  if (REDUCED) return;

  $$('.sec').forEach((sec) => {
    const kicker = $('.kicker', sec);
    const title = $('.sec-title', sec);
    const lead = $('.sec-lead', sec);
    if (!kicker && !title && !lead) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top 78%', once: true }
    });

    if (kicker) tl.from(kicker, { opacity: 0, y: 14, duration: 0.7 }, 0);
    if (title) tl.from(title, { opacity: 0, y: 24, duration: 0.9 }, 0.06);
    if (lead) tl.from(lead, { opacity: 0, y: 16, duration: 0.9 }, 0.14);
  });
}

/* ============================================================
    3. 名片墙卡片 —— 错峰淡入上移
   ============================================================ */

/**
 * 为「进入视口时淡入上移」建立可重复使用的观察器。
 *
 * 用 ScrollTrigger.batch 绑定元素有个问题：筛选/搜索会重建列表，
 * 新生成的卡片不在原观察范围内，动画就失效了。
 * 这里改成：每当容器内容变化，就把新出现的元素交给 ScrollTrigger 观察，
 * 已进入视口的立即播放，未进入的等到滚动到位再播。
 */
function revealOnScroll(container, selector, vars) {
  if (REDUCED || !container) return;

  const seen = new WeakSet();
  const pending = new Set();   // 已隐藏、等待触发显示的元素

  const observeNew = () => {
    const fresh = $$(selector, container).filter((el) => !seen.has(el));
    if (!fresh.length) return;
    fresh.forEach((el) => seen.add(el));

    // 已经出现在视口内的直接播放，其余交给 ScrollTrigger
    const inView = fresh.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    });
    if (inView.length) play(inView);

    fresh.filter((el) => !inView.includes(el)).forEach((el) => {
      pending.add(el);
      /* 页尾内容的触发线可能落在最大滚动范围之外 ——
         无论怎么滚都到不了，触发器永远不会开火，元素会一直透明。
         这类元素直接立即显示。 */
      // 触发系数从 vars.start（如 'top 92%'）里取，保持与触发器一致
      const pct = /([\d.]+)\s*%/.exec(vars.start);
      const factor = pct ? parseFloat(pct[1]) / 100 : 0.88;
      // 注意：先测量再设 y 位移，否则 transform 会污染 getBoundingClientRect
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      const startLine = docTop - window.innerHeight * factor;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const unreachable = startLine >= maxScroll - 4;
      gsap.set(el, { opacity: 0, y: vars.y });
      if (unreachable) {
        pending.delete(el);
        play([el]);
      } else {
        ScrollTrigger.create({
          trigger: el,
          start: vars.start,
          once: true,
          onEnter: () => { pending.delete(el); play([el]); }
        });
      }
    });
  };

  const play = (batch) => {
    batch.forEach((el) => pending.delete(el));
    gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: vars.duration,
      stagger: vars.stagger,
      ease: vars.ease || 'power3.out',
      overwrite: 'auto'
    });
  };

  observeNew();
  new MutationObserver(() => {
    // 等 DOM 更新完再取新元素，并刷新 ScrollTrigger 的测量位置
    requestAnimationFrame(() => {
      observeNew();
      ScrollTrigger.refresh();
    });
  }).observe(container, { childList: true, subtree: true });

  /* 兜底：页面滚到底时，把还没触发的元素全部显示出来。
     页面最后一节的内容永远无法达到「top 92%」的触发点，
     若没有这段兜底，页尾内容会一直保持透明。

     注意容差：元素自身的 translateY 会改变文档高度，
     scrollY 与 scrollHeight 会有几像素的偏差，不能用严格相等判断。 */
  const revealAll = () => {
    if (!pending.size) return;
    const remaining = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
    if (remaining > 40) return;
    const rest = Array.from(pending);
    pending.clear();
    play(rest);
  };
  window.addEventListener('scroll', revealAll, { passive: true });
  window.addEventListener('resize', revealAll);
}

function animateVillageCards() {
  revealOnScroll($('#vlist'), '.vrow', {
    start: 'top 88%',
    duration: 0.85,
    stagger: 0.07,
    y: 32
  });
}

/* ---------- 3b. 典型案例大卡 ---------- */

function animateFeatured() {
  if (REDUCED) return;
  const el = $('#featured');
  if (!el) return;
  gsap.from(el, {
    opacity: 0,
    y: 28,
    duration: 1,
    scrollTrigger: { trigger: el, start: 'top 85%', once: true }
  });
}

/* ============================================================
    4. 线路卡片 —— 揭示 + 配图缩放
   ============================================================ */

function animateRouteCards() {
  // 线路列表同样会被筛选/搜索重建，用可重复观察的揭示器
  revealOnScroll($('#routes-body'), '.route-card', {
    start: 'top 88%',
    duration: 0.85,
    stagger: 0.06,
    y: 26
  });

  // 线路分组标题
  $$('.group-title').forEach((t) => {
    gsap.from(t, {
      opacity: 0,
      x: -14,
      duration: 0.7,
      scrollTrigger: { trigger: t, start: 'top 90%', once: true }
    });
  });
}

/* ============================================================
    5. 「乡村土著」板块 —— 四类伙伴 / 赋能五步
   ============================================================ */

function animateLocalSection() {
  if (REDUCED) return;

  $$('.local-sec .feat').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  ScrollTrigger.batch('.tz-steps li', {
    start: 'top 90%',
    once: true,
    onEnter(batch) {
      gsap.from(batch, {
        opacity: 0,
        y: 22,
        duration: 0.7,
        stagger: 0.09
      });
    }
  });

  $$('.tz-cat').forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      scale: 0.9,
      duration: 0.55,
      delay: i * 0.05,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });
}

/* ============================================================
    6. FAQ —— 逐条淡入
   ============================================================ */

function animateFaq() {
  revealOnScroll($('#faq-list'), '.faq-item', {
    start: 'top 92%',
    duration: 0.7,
    stagger: 0.08,
    y: 18
  });
}

/* ============================================================
    7. 交互微动效 —— 卡片封面 / 配图 hover 放大
   ============================================================ */

function attachHoverZoom() {
  if (REDUCED) return;

  // 名片墙封面
  $$('.vrow.has-img').forEach((card) => {
    const cover = $('.vrow-cover', card);
    if (!cover) return;
    const enter = () => gsap.to(cover, {
      scale: 1.06,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    const leave = () => gsap.to(cover, {
      scale: 1,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    card.addEventListener('mouseenter', enter);
    card.addEventListener('mouseleave', leave);
  });

  // 线路卡配图
  $$('.rc-media').forEach((media) => {
    const enter = () => gsap.to(media, {
      scale: 1.05,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    const leave = () => gsap.to(media, {
      scale: 1,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    media.addEventListener('mouseenter', enter);
    media.addEventListener('mouseleave', leave);
  });

  // 典型案例大图
  const featImg = $('.featured-img');
  if (featImg) {
    const wrap = $('.featured');
    wrap.addEventListener('mouseenter', () => gsap.to(featImg, { scale: 1.04, duration: 1, ease: 'power2.out', overwrite: 'auto' }));
    wrap.addEventListener('mouseleave', () => gsap.to(featImg, { scale: 1, duration: 1, ease: 'power2.out', overwrite: 'auto' }));
  }
}

/* ============================================================
    8. 按钮 —— 轻微上浮 + 按下反馈
   ============================================================ */

function attachButtonMotion() {
  if (REDUCED) return;
  $$('.btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => gsap.to(btn, { y: -2, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }));
    btn.addEventListener('mouseleave', () => gsap.to(btn, { y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }));
  });
}

/* ============================================================
    9. 详情浮层 —— 打开时内容依次浮现
   ============================================================ */

function attachDetailMotion() {
  if (REDUCED) return;

  // 名片详情
  const detailBody = $('#detail-body');
  if (detailBody) {
    const obs = new MutationObserver(() => {
      const mods = $$('.module, .vhead, .source-box', detailBody);
      if (!mods.length) return;
      gsap.fromTo(mods,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out', overwrite: 'auto' }
      );
    });
    obs.observe(detailBody, { childList: true, subtree: true });
  }

  // 线路详情
  const rdBody = $('.rd-body');
  if (rdBody) {
    const obs2 = new MutationObserver(() => {
      const items = $$('.rd-meta, .rd-sum, .rd-h, .rd-gal, .rd-days, .rd-caveat, .rd-src', rdBody);
      if (!items.length) return;
      gsap.fromTo(items,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' }
      );
    });
    obs2.observe(rdBody, { childList: true, subtree: true });
  }
}

/* ============================================================
    10. 导航 —— 滚动后加深底色并收窄
   ============================================================ */

function attachNavMotion() {
  if (REDUCED) return;
  const nav = $('#nav');
  if (!nav) return;

  // 深色底与内边距的变化交给 CSS transition 平滑过渡，
  // 这里只负责在越过阈值时切换 class。
  ScrollTrigger.create({
    start: 'top -80',
    end: 99999,
    onUpdate: (self) => {
      nav.classList.toggle('is-scrolled', self.scroll() > 80);
    }
  });
}

/* ============================================================
    11. 段落背景切换（进度绑定滚动的模糊溶解）
    ============================================================ */

/**
 * 每个段落的背景是 position:fixed 的独立图层。
 * 过渡进度不走时间线，而是由滚动位置直接换算（scrub）：
 *
 *   段落分界线（下一段的顶边）在视口里从 66% 高度上移到 20% 高度
 *   的这段路程，就是过渡区间 —— 进度 p 从 0 走到 1。
 *
 *   出场层：opacity 1→0，blur 0→最大值（逐渐失焦）
 *   入场层：opacity 0→1，blur 最大值→0（逐渐对焦）
 *
 * 滚得快就切得快，滚得慢就切得慢，停在半路就停住 —— 过渡与手势 1:1。
 * 中段用 smoothstep 缓一下，起止两端更柔。
 */
function attachSectionBackdrop() {
  const sections = $$('.sec');
  if (!sections.length) return;

  const layers = sections.map((sec) => ({
    sec,
    bg: sec.querySelector('.sec-bg'),
    mask: sec.querySelector('.sec-mask')
  })).filter((l) => l.bg);

  if (layers.length < 2) return;

  const isMobile = () => window.matchMedia('(max-width: 920px)').matches;
  const maxBlur = () => (isMobile() ? 10 : 16);

  // 段落顶缓存：异步渲染会改变高度，resize/延时后失效重算
  let tops = null;
  const invalidate = () => { tops = null; };

  const smoothstep = (p) => p * p * (3 - 2 * p);

  const apply = () => {
    if (!tops) tops = layers.map((l) => l.sec.offsetTop);
    const vh = window.innerHeight;
    const scrollY = window.scrollY;
    const mb = maxBlur();

    // 找当前生效的分界。分界的视口位置 b 随 i 递增：
    //   b > zoneA  → 还没到这条分界的区间，后面的更远，break
    //   zoneB< b ≤ zoneA → 正处在这条分界的过渡区间，取它的进度
    //   b ≤ zoneB  → 这条已完全划过，继续看下一条
    let inIdx = 0, p = 0; // 默认第一段完全可见
    for (let i = 1; i < layers.length; i++) {
      const b = tops[i] - scrollY;               // 分界线的视口位置
      const outH = tops[i] - tops[i - 1];
      // 区间起点不能高于出场段自身的高度，否则在段内就开始虚化
      const zoneA = Math.min(vh * 0.66, outH - 60);
      if (b > zoneA) break;
      const zoneB = vh * 0.20;
      p = Math.min(1, Math.max(0, (zoneA - b) / Math.max(1, zoneA - zoneB)));
      inIdx = i;
      if (b <= zoneB) continue; // 已划过，看下一条
      break;                    // 正在过渡区间内
    }

    const pe = smoothstep(p); // 起止两端放缓
    layers.forEach((l, idx) => {
      let op = 0, blur = mb;
      if (inIdx === 0) {
        if (idx === 0) { op = 1; blur = 0; }
      } else if (idx === inIdx - 1) {
        op = 1 - pe; blur = mb * pe;          // 出场：逐渐失焦
      } else if (idx === inIdx) {
        op = pe; blur = mb * (1 - pe);        // 入场：逐渐对焦
      }

      const vis = op > 0.001;
      l.bg.style.opacity = op.toFixed(3);
      l.bg.style.filter = blur < 0.05 ? 'none' : `blur(${blur.toFixed(2)}px)`;
      l.bg.style.visibility = vis ? 'visible' : 'hidden';
      if (l.mask) {
        l.mask.style.opacity = op.toFixed(3);
        l.mask.style.visibility = vis ? 'visible' : 'hidden';
      }
    });
  };

  // 减少动态效果：不做虚化，按位置硬切
  if (REDUCED) {
    const update = () => {
      if (!tops) tops = layers.map((l) => l.sec.offsetTop);
      const probe = window.scrollY + window.innerHeight * 0.5;
      let active = 0;
      for (let i = 0; i < layers.length; i++) {
        if (probe >= tops[i]) active = i;
      }
      layers.forEach((l, idx) => {
        const on = idx === active;
        l.bg.style.opacity = on ? '1' : '0';
        l.bg.style.filter = 'none';
        l.bg.style.visibility = on ? 'visible' : 'hidden';
        if (l.mask) {
          l.mask.style.opacity = on ? '1' : '0';
          l.mask.style.visibility = on ? 'visible' : 'hidden';
        }
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => { invalidate(); update(); });
    setTimeout(() => { invalidate(); update(); }, 600);
    setTimeout(() => { invalidate(); update(); }, 1500);
    return;
  }

  apply();
  window.addEventListener('scroll', apply, { passive: true });
  window.addEventListener('resize', () => { invalidate(); apply(); });
  // 内容异步渲染会改变段落高度，重算分界位置
  setTimeout(() => { invalidate(); apply(); }, 500);
  setTimeout(() => { invalidate(); apply(); }, 1500);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { invalidate(); apply(); }).catch(() => {});
  }
}

/* ============================================================
    启动
   ============================================================ */

function initMotion() {
  animateHero();
  animateHeroStats();
  animateSectionHeadings();
  animateFeatured();
  animateVillageCards();
  animateRouteCards();
  animateLocalSection();
  animateFaq();
  attachHoverZoom();
  attachButtonMotion();
  attachDetailMotion();
  attachNavMotion();
  attachSectionBackdrop();

  // 页面内容是异步渲染的（接口取数 + ECharts 初始化），布局高度会持续变化。
  // ScrollTrigger 的触发位置是基于测量值算出来的，所以必须在内容稳定后
  // 重新测量，否则触发点会算在错误的位置上（表现为元素永远不出现）。
  const refresh = () => ScrollTrigger.refresh();
  requestAnimationFrame(refresh);
  setTimeout(refresh, 300);
  setTimeout(refresh, 900);
  setTimeout(refresh, 1800);
  // 字体加载完成会改变文字尺寸与行高，再测一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refresh).catch(() => {});
  }
  window.addEventListener('load', refresh);

  window.__motionReady = true;
}

// 等待 app.js 完成首屏渲染后再启动动效
if (document.readyState === 'complete') {
  setTimeout(initMotion, 60);
} else {
  window.addEventListener('load', () => setTimeout(initMotion, 60));
}

// 供调试与验证使用
window.__gsap = gsap;
window.__ScrollTrigger = ScrollTrigger;
