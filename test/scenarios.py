async def title(pg, shot, ev):
    await shot(pg, 'title')

async def start(pg, shot, ev):
    await pg.tap('#btn-play')
    await pg.wait_for_timeout(2500); await shot(pg, 'intro1')
    await pg.wait_for_timeout(3500); await shot(pg, 'intro2')
    # advance intro dialogue
    for i in range(6):
        await pg.tap('#dlg-box'); await pg.wait_for_timeout(700)
    await pg.wait_for_timeout(800); await shot(pg, 'free')
    print(await ev(pg, '({mode: window.__CS && __CS.player.state, t: __CS.constructor && 0, time: 0})'))

async def clock(pg, shot, ev):
    await pg.tap('#btn-play')
    for i in range(30):
        await pg.wait_for_timeout(500)
        r = await ev(pg, '({t: __CS.G.state.time.toFixed(2), lock: __CS.lockCount, modal: __CS.ui.modalStack.join(","), dlg: __CS.dialogue.active, mode: __CS.G.mode, fps: 0})')
        print(i, r)
        if r['dlg']:
            await pg.tap('#dlg-box')

async def start2(pg, shot, ev):
    await pg.tap('#btn-play')
    await pg.wait_for_timeout(2500)
    print('a', await ev(pg, '__CS.G.state.time'))
    await pg.wait_for_timeout(3500)
    print('b', await ev(pg, '__CS.G.state.time'))
    for i in range(6):
        await pg.tap('#dlg-box'); await pg.wait_for_timeout(700)
        print('tap', i, await ev(pg, '[__CS.G.state.time, __CS.dialogue.active, __CS.lockCount, document.getElementById("dlg-text").textContent.slice(0,30)]'))

async def boot_free(pg, ev):
    # skip intro: start new, then fast-forward via debug
    await pg.tap('#btn-play')
    await pg.wait_for_function('__CS.dialogue.active', timeout=30000)
    while await ev(pg, '__CS.dialogue.active'):
        await pg.evaluate('__CS.dialogue.typing=false; __CS.dialogue.tap()'); await pg.wait_for_timeout(250)
    await pg.wait_for_timeout(500)

async def touchdrag(pg, x0, y0, x1, y1, ms=1500, steps=20):
    cdp = await pg.context.new_cdp_session(pg)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}]})
    for i in range(1, steps + 1):
        x = x0 + (x1 - x0) * min(1, i / 5); y = y0 + (y1 - y0) * min(1, i / 5)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        await pg.wait_for_timeout(ms // steps)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

async def move(pg, shot, ev):
    await boot_free(pg, ev)
    p0 = await ev(pg, '[__CS.player.pos.x, __CS.player.pos.z, __CS.player.state]')
    await touchdrag(pg, 130, 300, 130, 230, 2500)   # joystick forward
    await shot(pg, 'walk')
    p1 = await ev(pg, '[__CS.player.pos.x, __CS.player.pos.z, __CS.player.state, __CS.cam.yaw]')
    await touchdrag(pg, 600, 200, 450, 200, 800)    # camera swipe
    await pg.wait_for_timeout(300)
    p2 = await ev(pg, '__CS.cam.yaw')
    print('pos', p0, '->', p1, 'camYaw', p2)
    # teleport near desk and sit
    await ev(pg, '__CS.player.place(-2.84, 0.6, Math.PI)')
    await pg.wait_for_timeout(800)
    print('action', await ev(pg, 'document.getElementById("act-label").textContent + " hidden=" + document.getElementById("btn-act").hidden'))
    await pg.tap('#btn-act'); await pg.wait_for_timeout(1200)
    await shot(pg, 'seated')
    await pg.tap('#btn-act'); await pg.wait_for_timeout(900)
    await shot(pg, 'computer')
    await pg.click('#mp-list .opt >> nth=0'); await pg.wait_for_timeout(1500)
    await shot(pg, 'montage')
    await pg.wait_for_timeout(4000)
    print('after task', await ev(pg, '[__CS.G.state.time, __CS.G.state.tasks, __CS.G.state.stats]'))
    await shot(pg, 'after')

async def jump(pg, t):
    await pg.evaluate(f'(()=>{{const g=__CS; g.G.state.time={t}; g.npcs.snapToSchedule({t});}})()')

async def dlg_until_choice(pg, ev, maxn=12):
    for i in range(maxn):
        if await ev(pg, 'document.querySelectorAll("#dlg-choices .choice").length > 0'): return True
        if not await ev(pg, '__CS.dialogue.active'): return False
        await pg.evaluate('__CS.dialogue.typing=false; __CS.dialogue.tap()'); await pg.wait_for_timeout(300)
    return False

async def choose(pg, i):
    await pg.click(f'#dlg-choices .choice >> nth={i}'); await pg.wait_for_timeout(400)

async def finish_dlg(pg, ev):
    for i in range(20):
        if not await ev(pg, '__CS.dialogue.active'): return
        if await ev(pg, 'document.querySelectorAll("#dlg-choices .choice").length > 0'): return
        await pg.evaluate('__CS.dialogue.typing=false; __CS.dialogue.tap()'); await pg.wait_for_timeout(300)

async def wait_dlg(pg, timeout=40000):
    await pg.wait_for_function('__CS.dialogue.active', timeout=timeout)

async def bring(pg, npc):
    # teleport an approaching NPC next to the player to save test time
    await pg.evaluate(f'(()=>{{const n=__CS.npcs.get("{npc}"), p=__CS.player.pos; n.pos.set(p.x+2.2, 0, p.z+0.4); n.node=null;}})()')

async def story(pg, shot, ev):
    await boot_free(pg, ev)
    await wait_dlg(pg, 40000) if False else None
    await bring(pg, 'manager'); await wait_dlg(pg)
    await dlg_until_choice(pg, ev); await shot(pg, 's_choice')
    await choose(pg, 0); await finish_dlg(pg, ev)
    print('after sure', await ev(pg, '[__CS.G.state.tasks.active, __CS.G.state.counters.sure, __CS.G.state.rel.manager]'))
    # meeting
    await jump(pg, 596); await ev(pg, '__CS.player.place(-12, -3.6, Math.PI)'); await pg.wait_for_timeout(1500)
    print('meet label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await pg.wait_for_timeout(1500); await shot(pg, 's_meeting')
    await dlg_until_choice(pg, ev); await choose(pg, 1); await finish_dlg(pg, ev)
    await pg.wait_for_timeout(2500)
    print('after meeting', await ev(pg, '[__CS.G.state.time, __CS.G.state.flags, __CS.player.state]'))
    await shot(pg, 's_after_meeting')
    # config at 11:00 -> refuse
    await jump(pg, 659.5); await pg.wait_for_timeout(1500); await bring(pg, 'manager'); await wait_dlg(pg)
    await dlg_until_choice(pg, ev); await choose(pg, 2); await finish_dlg(pg, ev)
    await pg.wait_for_timeout(800)
    # lunch
    await jump(pg, 740); await ev(pg, '__CS.player.place(-14.2, 7.85, -Math.PI/2)'); await pg.wait_for_timeout(1500)
    print('lunch label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await shot(pg, 's_lunch')
    await choose(pg, 0); await finish_dlg(pg, ev); await pg.wait_for_timeout(2500)
    # overheard finance scene
    await jump(pg, 748); await ev(pg, '__CS.player.place(-11.5, 5.2, -Math.PI/2)'); await pg.wait_for_timeout(1200)
    await shot(pg, 's_overhear')
    # snoop manager PC while he's at lunch
    await jump(pg, 770); await ev(pg, '__CS.player.place(13.0, -9.9, 0)'); await pg.wait_for_timeout(1500)
    print('pc label', await ev(pg, 'document.getElementById("act-label").textContent'), await ev(pg, '__CS.npcs.get("manager").at'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await finish_dlg(pg, ev); await pg.wait_for_timeout(600)
    print('clues', await ev(pg, '[__CS.G.state.clues, __CS.G.state.flags.managerDeployed]'))
    # incident
    await ev(pg, '__CS.player.place(-2.2, 1.2, Math.PI)')
    await jump(pg, 899.8); await pg.wait_for_timeout(2500); await shot(pg, 's_incident')
    await pg.wait_for_timeout(2500); await bring(pg, 'manager'); await wait_dlg(pg)
    await dlg_until_choice(pg, ev); await shot(pg, 's_incident_choice'); await choose(pg, 1); await finish_dlg(pg, ev)
    # fix via prod box
    await ev(pg, '__CS.player.place(-14.4, 0.2, -Math.PI/2)'); await pg.wait_for_timeout(1500)
    print('prod label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await choose(pg, 0)
    await pg.wait_for_timeout(2500); await shot(pg, 's_fixed')
    print('fixed', await ev(pg, '[__CS.G.state.flags.prodFixed, __CS.G.meta.achievements]'))
    # blame at 16:20
    await ev(pg, '__CS.player.place(-2.2, 1.2, Math.PI)')
    await jump(pg, 979.8); await pg.wait_for_timeout(1500); await bring(pg, 'manager'); await wait_dlg(pg)
    await dlg_until_choice(pg, ev); await shot(pg, 's_blame'); await choose(pg, 0); await dlg_until_choice(pg, ev)
    await shot(pg, 's_promo'); await choose(pg, 1); await finish_dlg(pg, ev)
    print('blame', await ev(pg, '[__CS.G.state.flags.reportedToHR, __CS.G.state.rel]'))
    # act 4 + leave via elevator at 17:05
    await jump(pg, 1004.8); await pg.wait_for_timeout(2500); await shot(pg, 's_act4')
    await jump(pg, 1025); await ev(pg, '__CS.player.place(1.5, 10.2, 0)'); await pg.wait_for_timeout(1500)
    print('elev label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await choose(pg, 0)
    await pg.wait_for_timeout(3000); await shot(pg, 's_elevator')
    await pg.wait_for_function('document.getElementById("ending").classList.contains("show")', timeout=30000)
    await pg.wait_for_timeout(9000); await shot(pg, 's_ending')
    await pg.wait_for_function('document.getElementById("end-summary").classList.contains("show")', timeout=30000)
    await pg.wait_for_timeout(800); await shot(pg, 's_summary')
    print('career', await ev(pg, 'JSON.stringify(__CS.G.meta.career)'))

async def leavedbg(pg, shot, ev):
    await boot_free(pg, ev)
    await jump(pg, 1025); await ev(pg, '__CS.player.place(1.5, 10.2, 0)'); await pg.wait_for_timeout(2000)
    print(await ev(pg, '({lock: __CS.lockCount, modal: __CS.ui.modalStack, mode: __CS.G.mode, dlg: __CS.dialogue.active, cur: __CS.interactions.current && __CS.interactions.current.label, appr: !!__CS.dir.approaching, appNpc: __CS.dir.approaching && __CS.dir.approaching.npc.id, pstate: __CS.player.state, portrait: __CS.portrait})'))
    await shot(pg, 'leavedbg')

async def settle(pg, ev):
    # finish any dialogue that pops up unexpectedly (always pick the last option)
    for i in range(30):
        if not await ev(pg, '__CS.dialogue.active'): return
        if await ev(pg, 'document.querySelectorAll("#dlg-choices .choice").length > 0'):
            n = await ev(pg, 'document.querySelectorAll("#dlg-choices .choice").length'); await choose(pg, n - 1)
        else:
            await pg.evaluate('__CS.dialogue.typing=false; __CS.dialogue.tap()'); await pg.wait_for_timeout(250)

async def ending_hr(pg, shot, ev):
    await boot_free(pg, ev)
    await settle(pg, ev)
    await pg.evaluate('(()=>{const s=__CS.G.state; s.flags.managerDeployed=true; s.flags.incident=true; s.clues.push("sticky_password","edit_history","deploy_log"); s.fired.push("mgr_morning","mgr_config","anu_print","hr_walk","incident","act2"); s.act=3;})()')
    await ev(pg, '__CS.player.place(-2.2, 1.2, Math.PI)')
    await jump(pg, 979.8); await pg.wait_for_timeout(1500); await bring(pg, 'manager'); await wait_dlg(pg)
    await dlg_until_choice(pg, ev); await shot(pg, 'e_blame'); await choose(pg, 0); await dlg_until_choice(pg, ev); await choose(pg, 1); await finish_dlg(pg, ev)
    await pg.wait_for_timeout(3000); await shot(pg, 'e_gone')
    print('mgr', await ev(pg, '[__CS.G.state.flags.mgrGone, __CS.npcs.get("manager").at, __CS.npcs.get("manager").state]'))
    await jump(pg, 1004.8); await pg.wait_for_timeout(2500); await settle(pg, ev)
    await jump(pg, 1025); await ev(pg, '__CS.player.place(1.5, 10.2, 0)'); await pg.wait_for_timeout(1500); await settle(pg, ev)
    print('elev label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await choose(pg, 0)
    await pg.wait_for_timeout(2600); await shot(pg, 'e_elevator')
    await pg.wait_for_function('document.getElementById("ending").classList.contains("show")', timeout=30000)
    await pg.wait_for_timeout(8000); await shot(pg, 'e_ending')
    await pg.wait_for_function('document.getElementById("end-summary").classList.contains("show")', timeout=30000)
    await pg.wait_for_timeout(800); await shot(pg, 'e_summary')
    print('career', await ev(pg, 'JSON.stringify(__CS.G.meta.career)'), await ev(pg, 'JSON.stringify(__CS.G.meta.achievements)'))
    await pg.click('[data-end="title"]'); await pg.wait_for_timeout(2500); await shot(pg, 'e_title')
    await pg.click('[data-act="career"]'); await pg.wait_for_timeout(800); await shot(pg, 'e_career')

async def misc(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    # printer loop: give task, try 3 times
    await pg.evaluate('(()=>{const s=__CS.G.state; s.tasks.active.push("printReport");})()')
    await ev(pg, '__CS.player.place(-14.4, -1.6, -Math.PI/2)'); await pg.wait_for_timeout(1000)
    for i in range(3):
        await settle(pg, ev)
        print('printer label', await ev(pg, 'document.getElementById("act-label").textContent'))
        await pg.tap('#btn-act'); await pg.wait_for_timeout(2400)
        if i < 2:
            await shot(pg, f'm_print{i}'); await pg.click('#note [data-close]'); await pg.wait_for_timeout(500)
        else:
            await shot(pg, 'm_print_menu'); await pg.click('#mp-list .opt >> nth=1'); await pg.wait_for_timeout(1000); await shot(pg, 'm_print_ok')
            await pg.click('#note [data-close]'); await pg.wait_for_timeout(500)
    print('printer', await ev(pg, '[__CS.G.state.tasks, __CS.G.state.counters.printerFails]'))
    # stall hide
    await ev(pg, '__CS.player.place(13.0, 8.2, Math.PI/2)'); await pg.wait_for_timeout(1000)
    t0 = await ev(pg, '__CS.G.state.time')
    await pg.tap('#btn-act'); await pg.wait_for_timeout(2500); await shot(pg, 'm_stall')
    await pg.click('#note [data-close]'); await pg.wait_for_timeout(600)
    print('stall', t0, await ev(pg, '[__CS.G.state.time, __CS.G.meta.achievements]'))
    # HR walk at 13:30
    await ev(pg, '__CS.player.place(-2.2, 1.2, Math.PI)')
    await jump(pg, 809.5); await pg.wait_for_timeout(1200); await settle(pg, ev)
    await pg.wait_for_timeout(1500); await shot(pg, 'm_hr_banner')
    await pg.evaluate('(()=>{const n=__CS.npcs.get("hr"), p=__CS.player.pos; n.pos.set(p.x+2.4,0,p.z+0.2); n.node=null;})()')
    await pg.wait_for_timeout(3500); await shot(pg, 'm_hr_stare')
    # manager hunting on the floor around 14:15
    await jump(pg, 855); await pg.wait_for_timeout(1500); await settle(pg, ev)
    await pg.evaluate('(()=>{const m=__CS.npcs.get("manager"); __CS.dir.lastReqTime=0; m.place("floor_mgr"); m.at="floor_mgr"; __CS.player.place(-1.5,1.3,Math.PI/2);})()')
    await pg.wait_for_timeout(2500); await shot(pg, 'm_hunt')
    print('hunt', await ev(pg, '[!!__CS.dir.approaching, __CS.dir.approaching && __CS.dir.approaching.dlg]'))
    await settle(pg, ev); await wait_dlg(pg, 30000); await dlg_until_choice(pg, ev); await shot(pg, 'm_hunt_dlg'); await choose(pg, 0); await settle(pg, ev)
    # save -> quit to title -> continue
    await ev(pg, '__CS.player.place(5.5, -9.5, 0)'); await pg.wait_for_timeout(500)
    await pg.tap('#btn-pause'); await pg.wait_for_timeout(500); await shot(pg, 'm_pause')
    await pg.click('#pause [data-act="status"]'); await pg.wait_for_timeout(600); await shot(pg, 'm_status'); await pg.click('#status [data-close]')
    await pg.click('#pause [data-act="quit"]'); await pg.wait_for_timeout(2500)
    before = await ev(pg, '__CS.savedDay && [__CS.savedDay.time, __CS.savedDay.tasks.active, __CS.savedDay.player]')
    print('saved', before)
    await shot(pg, 'm_title_continue')
    await pg.click('#btn-continue'); await pg.wait_for_timeout(2500)
    print('continued', await ev(pg, '[__CS.G.state.time, __CS.G.state.tasks.active, __CS.player.pos.x, __CS.player.pos.z, __CS.G.mode]'))
    await shot(pg, 'm_continued')

async def portrait(pg, shot, ev):
    await shot(pg, 'portrait')

async def wait_ending(pg, ev, name, shot):
    await pg.wait_for_function('document.getElementById("end-summary").classList.contains("show")', timeout=60000)
    r = await ev(pg, '__CS.G.state.ending')
    await pg.wait_for_timeout(500); await shot(pg, name)
    return r

async def meltdown(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    await pg.evaluate('__CS.G.state.stats.sanity = 0.2'); await wait_dlg(pg); await shot(pg, 'x_melt1'); await settle(pg, ev)
    print('after 1st', await ev(pg, '[__CS.G.state.stats.sanity, __CS.G.state.counters.chaos]'))
    await pg.evaluate('__CS.G.state.stats.sanity = 0.2'); await wait_dlg(pg); await settle(pg, ev)
    print('ending', await wait_ending(pg, ev, 'x_melt_end', shot))

async def quit(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    await ev(pg, '__CS.player.place(1.5, 10.2, 0)'); await pg.wait_for_timeout(1200)
    print('label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await shot(pg, 'x_hr_intercept')
    await choose(pg, 2); await settle(pg, ev)
    print('ending', await wait_ending(pg, ev, 'x_quit_end', shot))

async def stairs(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    await jump(pg, 1021); await pg.wait_for_timeout(800); await settle(pg, ev)
    await ev(pg, '__CS.player.place(4.0, 10.3, 0)'); await pg.wait_for_timeout(1200); await settle(pg, ev)
    print('label', await ev(pg, 'document.getElementById("act-label").textContent'))
    await pg.tap('#btn-act'); await wait_dlg(pg); await dlg_until_choice(pg, ev); await choose(pg, 0); await settle(pg, ev)
    await pg.wait_for_timeout(2500); await settle(pg, ev)
    print('ending', await wait_ending(pg, ev, 'x_stairs_end', shot))

async def overtime(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    await jump(pg, 1049.5); await ev(pg, '__CS.player.place(-2.2, 1.2, Math.PI)')
    for i in range(20):
        await settle(pg, ev); await pg.wait_for_timeout(600)
        if await ev(pg, '__CS.G.mode === "ending"'): break
    print('ending', await wait_ending(pg, ev, 'x_overtime_end', shot))

async def sizes(pg, shot, ev):
    await boot_free(pg, ev)
    await bring(pg, 'manager'); await wait_dlg(pg); await dlg_until_choice(pg, ev)
    w = await ev(pg, 'innerWidth')
    await shot(pg, f'sz_{w}_dlg'); await choose(pg, 3); await settle(pg, ev); await pg.wait_for_timeout(1500)
    await shot(pg, f'sz_{w}_free')

async def overhear(pg, shot, ev):
    await boot_free(pg, ev); await settle(pg, ev)
    await pg.evaluate('__CS.G.state.fired.push("mgr_morning","mgr_config","anu_print")')
    await jump(pg, 748); await pg.wait_for_timeout(1500); await settle(pg, ev)
    await ev(pg, '__CS.player.place(-11.8, 5.4, -Math.PI/2)')
    for i in range(18):
        await pg.wait_for_timeout(1500); await settle(pg, ev)
        st = await ev(pg, 'JSON.stringify([__CS.dir.sceneState.finance, __CS.G.state.flags.managerDeployed, __CS.npcs.get("arjun").state, __CS.npcs.get("arjun").at, __CS.G.state.time.toFixed(1)])')
        print(st)
        if i == 2: await shot(pg, 'ovh')
        if '"done":true' in st: break
    print('clues', await ev(pg, '__CS.G.state.clues'))
