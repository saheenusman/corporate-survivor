# Usage: python3 test/shot.py <html> <out.png> [query] [w] [h] [wait_ms]
import sys, asyncio
from playwright.async_api import async_playwright
html, out = sys.argv[1], sys.argv[2]
q = sys.argv[3] if len(sys.argv) > 3 else ''
w = int(sys.argv[4]) if len(sys.argv) > 4 else 1280
h = int(sys.argv[5]) if len(sys.argv) > 5 else 640
wait = int(sys.argv[6]) if len(sys.argv) > 6 else 1500
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('file://' + html + q)
        await pg.wait_for_timeout(wait)
        await pg.screenshot(path=out)
        for l in logs[:40]: print(l)
        await b.close()
asyncio.run(main())
