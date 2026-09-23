# Corporate Survivor — One More Quick Thing™

A mobile-first 3D workplace survival comedy. It is Monday, 8:57 AM. Survive until 5:30 PM.

**▶ Play:** https://saheenusman.github.io/corporate-survivor/

Everything is generated in code (characters, office, signs, sound), so the whole game ships as
**one self-contained HTML file** (`dist/index.html`, ~710 KB). No server and no downloads at runtime.

## Play

- Open `dist/index.html` in any modern browser, or host it anywhere static (GitHub Pages, Netlify, S3…).
  When hosting, upload everything in `dist/` (`index.html`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`).
- **Full screen:** on Android, the game goes full screen when you tap Play; the pause menu has a Full screen toggle. For a true app feel (and on iPhone, where browsers don't allow full screen), use the browser menu → *Add to Home screen*.
- **Phone:** landscape. Drag the left side to walk; swipe the right side to look; tap the yellow button to interact.
- **Desktop:** WASD / arrows to walk, Shift to run, drag the mouse to look, E / Space to interact, Esc to pause, T for tasks, 1–4 to pick dialogue choices.

## How updates go live

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on GitHub Actions:

1. install dependencies (`npm ci`)
2. test the ending rules (`node test/endings-test.mjs`)
3. build the single-file game (`node build.mjs` → `dist/`)
4. publish `dist/` to GitHub Pages

If a step fails, nothing is published and the live site stays on the last working version.
Progress is visible in the repository's **Actions** tab. The built file is never committed, so the code and the live game can't drift apart.

## Build locally

```bash
npm install
npm run build      # -> dist/index.html (minified, everything inlined)
npm run dev        # rebuild on change
npm run serve      # serve dist/ on http://localhost:8080
```

Requires Node 18+. Dependencies: `three` (runtime), `esbuild` (build only).

## Saving

Progress autosaves (every ~25 s, after tasks, and when the tab is hidden).

- Inside Claude it uses Claude's artifact storage.
- Hosted normally it uses `localStorage`.
- If storage is blocked (e.g. some private modes) it falls back to memory, so the game still runs without saving.

**Reset:** Settings › Reset all progress.

## Code map (`src/js/`)

| Folder | Contents |
|---|---|
| `config.js` | All tuning: day length, speeds, camera, quality presets |
| `core/` | Event bus, math helpers, storage adapter |
| `state/game-state.js` | The single serialisable day state + meta (settings, career, achievements); `applyFx()` is the only way stats change |
| `characters/` | Procedural skinned humans with a face rig, the pose/expression animator, and the cast's looks |
| `world/` | Office builder (static geometry batched into a few draw calls), navigation graph, collision |
| `render/` | Renderer, time-of-day lighting, and canvas textures including the sign atlas with every office joke |
| `gameplay/` | Player controller, camera rig, NPC agents, interactions, and the **director** (clock, timeline, ambushes, overheard scenes, exits) |
| `story/` | Data only: dialogues, tasks and clues, schedules, endings, achievements, interactable objects |
| `ui/` | HUD, panels, montage, endings, and the dialogue presenter |
| `main.js` | Boot, title flow, game loop, and the glue actions (talk, computer, printer, save) |

To add content, you usually only touch `story/`.

- **Dialogue:** add a tree to `DLG` in `dialogues.js`.
- **Timed beat:** add an event in `Director.buildEvents()`.
- **Interactable:** add an entry in `registerObjects()` in `objects.js`.

## Tests (`test/`)

Headless Chromium via Playwright (Python), rendering with SwiftShader.

- `python3 test/play.py <scenario> [w h]` runs a scenario from `scenarios.py` and saves screenshots to `/tmp`. Scenarios: `story`, `move`, `misc`, `meltdown`, `quit`, `stairs`, `overtime`, `sizes`, …
- `node test/endings-test.mjs` checks the ending rules.
- `?debug=1` exposes `window.__CS` for scripted testing. There is no debug UI in normal play.

## Endings (7)

Corporate Hero · The Escape · Middle Management · Whistleblower · Chaos · Enlightenment · Overtime.
Each is decided by what you did, who you helped or blamed, and when you left.
