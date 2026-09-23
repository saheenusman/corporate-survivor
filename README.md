# Corporate Survivor — One More Quick Thing™

A mobile-first 3D workplace survival comedy. It's Monday, 8:57 AM. Survive until 5:30 PM.

**▶ Play:** https://saheenusman.github.io/corporate-survivor/

Everything is generated in code: characters, the office, every sign and joke, and all sound. There are no image, model or audio files.

---

## How it fits together

```
 source (this repo)            build (build.mjs)               live site (GitHub Pages)
 ──────────────────            ─────────────────               ────────────────────────
 src/js/**  (30 modules) ─┐
 three.js (npm package) ──┼─► esbuild bundles into one ─┐
                          │   minified script           │
 src/styles.css ──────────┼─────────────────────────────┼─► dist/index.html ──┐
 src/index.html (shell) ──┘   CSS + script inlined ─────┘   (one file, no      │
                                                            external requests) ├─► published by
 public/ (manifest, icons) ───── copied as-is ───────────►  dist/manifest…     │   GitHub Actions
                                                            dist/icon-*.png  ──┘
```

The repository holds only **source code**. The playable game is **built**, never written by hand: `dist/` is created by the build and is not committed.

---

## Repository layout

```
.github/workflows/deploy.yml   Automation: test → build → publish on every push to main
build.mjs                      The build script (see "What the build does")
package.json                   Scripts + dependencies (three.js at runtime, esbuild for building)
package-lock.json              Exact dependency versions, so every build is identical

public/                        Copied unchanged into dist/
  manifest.webmanifest           Makes "Add to Home screen" launch full screen, landscape
  icon-192.png, icon-512.png     App icons

src/
  index.html                   HTML shell: every screen and panel (loading, title, HUD, dialogue, menus,
                               endings), with two placeholders the build fills in: /*__CSS__*/ and /*__JS__*/
  styles.css                   All UI styling
  js/
    main.js                    Entry point: boot + loading, title flow, game loop, and actions that
                               tie systems together (talk, work montage, computer, printer, save, endings)
    config.js                  All tuning: day length, walking speeds, camera, graphics quality presets
    core/        events.js       Event bus between systems
                 storage.js      Save adapter: Claude artifact storage → localStorage → memory
                 util.js         Math and timing helpers
    state/       game-state.js   The one saveable day state + career/settings/achievements.
                                 applyFx() is the only way stats and relationships change
    characters/  character.js    Procedural skinned humans (one mesh each) with a face rig and props
                 animator.js     Blended poses (walk, sit, type, talk, phone…) and facial expressions
                 looks.js        Each cast member's appearance, name, role and voice pitch
    world/       office.js       Builds the office; static objects are merged into a few draw calls
                 batch.js        The geometry merger, with baked shading near the floor
                 nav.js          Walking routes for NPCs + named spots (desks, coffee, cafeteria…)
                 collision.js    Walls and furniture for walking and for the camera
    render/      renderer.js     WebGL setup and time-of-day lighting (cool morning → warm evening)
                 textures.js     Canvas-drawn floors, screens, and the sign atlas with every office joke
    gameplay/    player.js       Movement, sitting, scripted walks
                 camera.js       Third-person camera, conversation framing, title orbit
                 npcs.js         NPC agents following daily schedules
                 interactions.js Finds what you can use and drives the context button
                 director.js     Runs the day: clock, stat drift, story beats, manager ambushes,
                                 overheard conversations, the incident, leaving the building
    input/       input.js        Touch joystick + swipe camera, keyboard and mouse
    audio/       audio.js        Synthesised sound effects, ambience and music (Web Audio)
    ui/          ui.js           HUD, toasts, panels, work montage, endings
                 dialogue-ui.js  Plays dialogue trees: typewriter text, choices, speaker badges
    story/       dialogues.js    Every conversation and its choices           ┐
                 tasks.js        Tasks and clues                              │ Pure data:
                 schedules.js    NPC daily routines, overheard scenes, lines  │ most new content
                 endings.js      The 7 endings: rules and text                │ only touches
                 achievements.js Achievements                                 │ these files
                 objects.js      Everything you can interact with             ┘

test/                          Checks and visual test harnesses (not part of the game)
```

---

## What the build does

`node build.mjs` (or `npm run build`) turns the source into the playable game in four steps:

1. **Bundle the code.** [esbuild](https://esbuild.github.io/) starts at `src/js/main.js` and follows every `import`, including three.js from `node_modules`. It combines everything into **one minified script** targeting browsers from 2020 onward, including Safari 14.
2. **Fill in the HTML shell.** It reads `src/index.html` and replaces `/*__CSS__*/` with `src/styles.css` and `/*__JS__*/` with the bundled script.
3. **Write the game.** The result is `dist/index.html`, about **710 KB**, or about **200 KB** as actually downloaded, because GitHub Pages compresses it.
4. **Copy the extras.** Everything in `public/` goes into `dist/` next to it.

**Why one file?** The game works anywhere with no setup: opened straight from disk, inside Claude, or on any static host. It loads in a single request with nothing fetched from other servers.

The trade-off: every update re-downloads the whole file. At ~200 KB that's fine. If the game ever gains large assets (3D models, music), the right move is to split out three.js and the assets so browsers can cache them separately.

The manifest and icons in `dist/` are linked only when the game runs as a normal page over `https`. Opened from disk or inside Claude, they're skipped, so nothing fails to load.

---

## How updates go live

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on GitHub Actions:

| Step | What happens |
|---|---|
| 1. Install | `npm ci`: installs the exact versions in `package-lock.json` |
| 2. Test | `node test/endings-test.mjs`: checks that every ending is reachable by its rules |
| 3. Build | `node build.mjs` → `dist/` |
| 4. Publish | `dist/` is uploaded and deployed to GitHub Pages |

- **Failures are safe.** If any step fails, nothing is published and the live site keeps the last working version.
- **Progress is visible.** Each run shows in the repository's **Actions** tab.
- **The built file is never committed.** The live game always matches the code.
- **Speed.** A full run takes under a minute.

---

## Working on it locally

Requires **Node 20+** (the automated build uses Node 22).

```bash
npm install
npm run build      # build dist/ once (minified)
npm run dev        # rebuild automatically when anything in src/ changes (unminified, easier to debug)
npm run serve      # serve dist/ at http://localhost:8080 (caching off)
```

Then open `http://localhost:8080`. You can also open `dist/index.html` directly from disk.

### Adding content

- **A conversation:** add a dialogue tree to `DLG` in `src/js/story/dialogues.js`.
- **A timed story beat:** add an event in `buildEvents()` in `src/js/gameplay/director.js`.
- **Something to interact with:** add an entry in `registerObjects()` in `src/js/story/objects.js`.
- **Balance:** day length, speeds and quality presets are in `src/js/config.js`.

### Tests

- **`node test/endings-test.mjs`:** plain logic test of the ending rules. Runs on every deploy.
- **`python3 test/play.py <scenario> [width height]`:** plays the real game in headless Chromium with a phone-sized touch screen, and saves screenshots to `/tmp`.
  - Scenarios are in `test/scenarios.py`: `story`, `move`, `misc`, `meltdown`, `quit`, `stairs`, `overtime`, `sizes`…
  - Needs `pip install playwright` and `playwright install chromium`, plus a build in `dist/`.
- **`test/desk.py`:** the same kind of check on a desktop screen with keyboard and mouse.
- **`test/char-test.js`, `test/office-test.js`:** standalone visual harnesses for the characters and the office. Bundle one with `node test/build-test.mjs <file> <out.html>`, then screenshot it with `python3 test/shot.py <absolute path to out.html> <image.png>`.

Adding `?debug=1` to the URL exposes `window.__CS` so the test scripts can control the game. There is no debug UI in normal play.

---

## Playing

- **Phone:** landscape. Drag the left side to walk, swipe the right side to look, and tap the yellow button to interact.
  - On Android, tapping the title screen or Play goes full screen; Pause › Full screen toggles it.
  - For an app with no browser bars, use the browser menu › **Add to Home screen**. This is the only way on iPhone, where browsers don't allow full screen.
- **Desktop:** WASD / arrows to walk, Shift to run, drag to look, E / Space to interact, Esc to pause, T for tasks, 1–4 to pick choices.

**Saving:** progress autosaves every ~25 s, after tasks, and when you leave the tab.
- Each player's save lives in their own browser (`localStorage`); inside Claude it uses Claude's artifact storage.
- If storage is blocked, as in some private modes, the game still runs but won't remember.
- Settings › Reset all progress clears it.

**Endings (7):** Corporate Hero · The Escape · Middle Management · Whistleblower · Chaos · Enlightenment · Overtime. Each is decided by what you did, who you helped or blamed, and when you left.
