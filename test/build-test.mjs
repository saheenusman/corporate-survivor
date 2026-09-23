import * as esbuild from 'esbuild';
import fs from 'fs';
const entry = process.argv[2], out = process.argv[3];
const r = await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', write: false, minify: false, logLevel: 'error' });
fs.writeFileSync(out, `<!doctype html><html><body style="margin:0"><script>${r.outputFiles[0].text}</script></body></html>`);
