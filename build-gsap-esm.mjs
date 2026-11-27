// 构建自包含的 ESM 版 GSAP（含 ScrollTrigger），供浏览器 <script type="module"> 直接引入。
// GSAP 官方包是「多文件相对 import」的 ESM 源码，无法直接放进 public/ 供浏览器加载，
// 这里用 Node 自带能力把依赖模块内联成一个单文件 ESM bundle（不引入任何打包器）。
//
// 用法：node build-gsap-esm.mjs
// 产物：public/vendor/gsap-esm.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GSAP_DIR = path.join(__dirname, 'node_modules', 'gsap');

// 模块顺序 = 依赖拓扑顺序
const MODULES = [
  { file: 'gsap-core.js', from: 'gsap-core.js' },
  { file: 'CSSPlugin.js', from: 'CSSPlugin.js' },
  { file: 'Observer.js', from: 'Observer.js' },
  { file: 'ScrollTrigger.js', from: 'ScrollTrigger.js' }
];

// 把 "import { a, b as c } from './x.js';" 改写为对该内联模块的引用
function resolveImports(code, currentFile, fileMap) {
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/([^'"]+)['"]\s*;?/g;
  return code.replace(re, (m, names, target) => {
    const key = target.endsWith('.js') ? target : target + '.js';
    if (!fileMap.has(key)) return m;
    const ns = `__mod${fileMap.get(key)}`;
    const decls = names
      .split(',')
      .map((s) => s.replace(/\/\/[^\n]*/g, '').trim())
      .filter(Boolean)
      .map((n) => {
        const m2 = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(n);
        if (!m2) return null;
        const orig = m2[1];
        const local = m2[2] || m2[1];
        return `const ${local} = ${ns}.${orig};`;
      })
      .filter(Boolean);
    return decls.length ? decls.join(' ') : '';
  });
}

const fileMap = new Map();
MODULES.forEach((m, i) => fileMap.set(m.from, `_${i}`));

const parts = [];
parts.push(`/*!
 * GSAP 3.15.1 — ESM 自包含构建（含 ScrollTrigger）
 * 由 build-gsap-esm.mjs 从 node_modules/gsap 内联生成，供浏览器直接 import。
 * GSAP 标准许可：https://gsap.com/standard-license
 */
`);

MODULES.forEach((m, i) => {
  let code = fs.readFileSync(path.join(GSAP_DIR, m.file), 'utf8');
  code = resolveImports(code, m.file, fileMap);
  // 移除该模块自身的 export 语句，改为在 IIFE 末尾 return 出去
  const expNames = collectExports(m.file).filter((n) => n !== 'default');
  code = code.replace(/^export\s*\{[^}]*\}\s*;?/gm, '');
  code = code.replace(/^export\s+(var|let|const|function|class)\s/gm, '$1 ');
  code = code.replace(/^export\s+default\s+/gm, 'const __default_' + i + ' = ');
  // 收集到的导出名可能在 export{} 里被重命名（orig as alias），此处按源码里的实际标识符取值
  const retProps = collectExportProps(m.file);
  parts.push(
    `/* ---- ${m.file} ---- */\nconst __mod_${i} = (() => {\n${code}\nreturn { ${retProps.join(', ')} };\n})();`
  );
});

// 收集各模块导出的标识符
function collectExports(file) {
  const code = fs.readFileSync(path.join(GSAP_DIR, file), 'utf8');
  const names = new Set();
  const re1 = /export\s*\{([^}]*)\}/gs;
  let m;
  while ((m = re1.exec(code))) {
    m[1].split(',').map((s) => s.replace(/\/\/[^\n]*/g, '').trim()).filter(Boolean).forEach((n) => {
      const parts2 = n.split(/\s+as\s+/);
      names.add(parts2[0].trim());
    });
  }
  const re2 = /^export\s+(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = re2.exec(code))) names.add(m[1]);
  if (/export\s+default\s/.test(code)) names.add('default');
  return [...names];
}

// 生成 "本地标识符: 导出名" 形式的返回属性，正确处理 `a as b` 重命名
function collectExportProps(file) {
  const code = fs.readFileSync(path.join(GSAP_DIR, file), 'utf8');
  const props = new Map(); // exportedName -> localName
  const re1 = /export\s*\{([^}]*)\}/gs;
  let m;
  while ((m = re1.exec(code))) {
    m[1].split(',').map((s) => s.replace(/\/\/[^\n]*/g, '').trim()).filter(Boolean).forEach((n) => {
      const parts2 = n.split(/\s+as\s+/).map((x) => x.trim());
      const local = parts2[0];
      const exported = parts2[1] || parts2[0];
      props.set(exported, local);
    });
  }
  const re2 = /^export\s+(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = re2.exec(code))) props.set(m[1], m[1]);
  // 只保留源码中真实存在且未被上面剔除 export 关键字后仍然可访问的标识符
  return [...props.entries()].map(([exported, local]) => `${exported}: ${local}`);
}

const gsapCoreExports = collectExports('gsap-core.js');
const cssPluginExports = collectExports('CSSPlugin.js');
const stExports = collectExports('ScrollTrigger.js');

const coreNames = gsapCoreExports.filter((n) => n !== 'default');
const cssNames = cssPluginExports.filter((n) => n !== 'default');

parts.push(`
/* ---- 统一导出 ---- */
const { gsap: __gsapCore } = __mod_0;
const { CSSPlugin } = __mod_1;
const gsap = __gsapCore.registerPlugin(CSSPlugin) || __gsapCore;
const { ScrollTrigger } = __mod_3;
gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger, CSSPlugin };
export default gsap;
`);

const out = parts.join('\n\n');
const dest = path.join(__dirname, 'public', 'vendor', 'gsap-esm.js');
fs.writeFileSync(dest, out, 'utf8');

console.log('written:', dest);
console.log('size:', (out.length / 1024).toFixed(1), 'KB');
console.log('core exports:', coreNames.length, '| css exports:', cssNames.length, '| ScrollTrigger exports:', stExports.length);
