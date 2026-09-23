# Desktop (mouse + keyboard, no touch) check.
import os, asyncio
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': 1366, 'height': 768})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist', 'index.html')) + '?debug=1')
        await pg.wait_for_function('window.__CS && document.getElementById("title").classList.contains("show")', timeout=60000)
        await pg.wait_for_timeout(800); await pg.screenshot(path='/tmp/p_d_title.png')
        await pg.click('#btn-play')
        await pg.wait_for_function('__CS.dialogue.active', timeout=30000)
        while await pg.evaluate('__CS.dialogue.active'):
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(350)
        await pg.wait_for_timeout(500)
        x0 = await pg.evaluate('[__CS.player.pos.x, __CS.player.pos.z]')
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(2000); await pg.keyboard.up('KeyW')
        await pg.keyboard.down('ShiftLeft'); await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(1000); await pg.keyboard.up('KeyW'); await pg.keyboard.up('ShiftLeft')
        x1 = await pg.evaluate('[__CS.player.pos.x, __CS.player.pos.z]')
        await pg.mouse.move(900, 400); await pg.mouse.down(); await pg.mouse.move(700, 420, steps=8); await pg.mouse.up()
        print('keyboard move', x0, '->', x1, 'camYaw', await pg.evaluate('__CS.cam.yaw'))
        await pg.evaluate('__CS.player.place(-2.84, 0.6, Math.PI)'); await pg.wait_for_timeout(800)
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(800)
        print('seated', await pg.evaluate('__CS.player.state'))
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/p_d_menu.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        print('pause open', await pg.evaluate('__CS.ui.modalStack'))
        await pg.screenshot(path='/tmp/p_d_pause.png')
        print('info', await pg.evaluate('JSON.stringify(__CS.renderer.info.render)'))
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
