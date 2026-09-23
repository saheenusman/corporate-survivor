# Scenario runner: python3 test/play.py <scenario> [w h]
import sys, os, asyncio, json
from playwright.async_api import async_playwright
SC = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 844
H = int(sys.argv[3]) if len(sys.argv) > 3 else 390
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist', 'index.html')) + '?debug=1'
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']

async def shot(pg, name):
    await pg.screenshot(path=f'/tmp/p_{name}.png'); print('shot', name)

async def ev(pg, js):
    return await pg.evaluate(js)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto(URL)
        await pg.wait_for_function('window.__CS && document.getElementById("title").classList.contains("show")', timeout=60000)
        await pg.wait_for_timeout(1200)
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        mod = __import__('scenarios')
        await getattr(mod, SC)(pg, shot, ev)
        for l in logs[:30]: print(l)
        await b.close()
asyncio.run(main())
