// Bundles the game into ONE self-contained file: dist/index.html
// (CSS + JS + three.js inlined, no external requests). Usage:
//   node build.mjs          production build (minified)
//   node build.mjs --watch  rebuild on change (unminified)
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');
const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'dist', 'index.html');

async function build() {
  const t0 = Date.now();
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'src/js/main.js')],
    bundle: true, format: 'iife', target: ['es2020', 'safari14'],
    minify: !watch, legalComments: 'none', write: false, logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  // static extras for hosting: web-app manifest + icons (Add to Home Screen)
  const pub = path.join(root, 'public');
  if (fs.existsSync(pub)) for (const f of fs.readdirSync(pub)) fs.copyFileSync(path.join(pub, f), path.join(path.dirname(out), f));
  console.log(`built dist/index.html  ${(html.length / 1024).toFixed(0)} KB  in ${Date.now() - t0} ms`);
}

await build();
if (watch) {
  console.log('watching src/ …');
  let t = null;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => build().catch((e) => console.error(e.message)), 120); });
}
