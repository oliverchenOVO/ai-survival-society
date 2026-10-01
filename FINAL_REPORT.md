# AI Survival Society — final delivery report

Date: 2026-10-02 (Asia/Taipei). Working directory: `C:\Users\oliver\Desktop\CodeX開發小東東\AI Survival Society`.

Status terms are literal: **COMPLETED** means implemented and executed; **PARTIAL** means a usable scoped version with stated limits; **NOT IMPLEMENTED** means absent, not a disguised TODO.

## 1. What was built — COMPLETED

A working interactive 3D survival society: twelve autonomous robots explore a procedurally generated island, gather supplies, communicate, trade, cooperate, form alliances, deceive, steal, fight, retreat and sometimes betray. Scarcity and a contracting safe zone produce a real final survivor. The user observes decisions and can change the environment through Director mode.

The deliverable includes a browser observatory, packaged Windows desktop application, editable Blender assets, replay archive, model adapter, full test evidence, launch/stop scripts and source control. It is an operating product, not an empty Unity scene or architecture skeleton.

## 2. Technology stack — COMPLETED

- React 19 + Vite + Lucide for the observatory UI.
- Three.js for the actual WebGL world, camera, lighting, shadows, bloom and animation; Delaunator for natural terrain triangulation.
- Node.js 24.13.0 + Express + WebSocket for authoritative simulation and persistence.
- Electron 44.5.1 for Windows desktop distribution; renderer sandbox, context isolation and no Node integration.
- Blender 3.1.2 / bpy for reproducible robot sources and GLB exports.
- Ollama qwen2.5:1.5b validated locally, plus an OpenAI-compatible adapter.
- Playwright with installed Chrome for actual rendered QA; Node test runner; FFmpeg for demo video.

Unity 6000.2.0f1, Hub and Windows/WebGL modules were inspected. They were not used: the shared Three.js client gives desktop and browser the same tested implementation. This is not a Unity project.

## 3. Architecture — COMPLETED

`core/` contains seeded random generation, agents, Utility decisions, resource/world rules, combat, memories, relationship updates, Event Bus and historian templates. `server/` handles controls, snapshots, atomic JSON persistence and background model adapters. `src/components/` owns UI surfaces; `src/world/` owns rendering and camera. `desktop/` starts the same backend on an ephemeral loopback port.

The client never calls a model or holds a model key. The backend does not wait for model inference to advance the world. Scene generation and art generation are scripts, not manual Editor click sequences.

## 4. Features completed — COMPLETED

- Twelve named, visually distinct robots, eight 0–1 personality traits, health/hunger/energy, inventory, weapon, goals, trust/affinity/fear/hostility and capped important memories.
- Scored autonomous exploration, forage, eat, heal, rest, talk, trade, ally, cooperate, deceive, steal, attack, flee and betray choices.
- Forest, river, timber bridges, village, ruins, mountain, central supply beacon and collectible food/medicine/weapons/relics.
- Start/restart, pause/resume, 0.5×–32× speed, configurable seeds and continuous mode.
- Click/select/focus, orbit/pan/zoom, follow agent and cinematic event focus.
- Inspector portrait/vitals/inventory/weapon/current goal, observed situation, action, public reason, utility scores, personality, relationships and important memories.
- Live feed, colored real-time social graph and data-derived survivor/trade/alliance/betrayal/trust/ranking statistics.
- All six Director events; food crisis affects food generation only, by −70%.
- Contracting safety zone, combat/death/winner statistics and four-chapter event historian.
- JSON logging, export, atomic saves, archives, replay scrub/play/import and bounded retention.
- Model-free operation and optional local/remote models.
- Synthesized ambient/event sound, shadows, bloom, dust particles, robot motion, animated ocean and warm sky.

## 5. Blender assets generated — COMPLETED

`Art/Blender/society_robots.blend` is the editable source; `Art/Blender/generate_assets.py` rebuilds all twelve robots: Nova, Atlas, Echo, Vex, Iris, Kairo, Lyra, Onyx, Sage, Rune, Pax and Juno. Identity colors, head forms and antenna/crest/ear accessories differ. Exports live under `Art/Exports/`, with runtime copies under `public/assets/`.

Source size is about 4.7MB; each GLB about 150KB. Git LFS was assessed and is unnecessary for these assets. Characters use procedural locomotion/bob rather than a full skeletal animation rig.

The Image Gen concept is preserved under `docs/design/concept.png`; it guided the dark observatory composition. Actual game geometry is authored and rendered in Blender/Three.js. README screenshots show the real application, not that concept.

## 6. AI system — COMPLETED

The core is Utility AI combined with needs, personality, directional relationships, emotional memories, resources, proximity and environmental pressure. Memories include who/what/when/importance/emotional impact. Events update trust, affinity, fear and hostility; the action choice reacts to those states.

Twenty full seeds completed with a real winner in every run. Totals: **236 alliances, 248 trades, 14 betrayals, 50 cooperative acts**. These outcomes are generated by the rules and seeded random choices, not by a fixed narrative. Repeated identical seeds and timed Director interventions reproduced complete event logs and final states.

## 7. LLM integration — COMPLETED (local), PARTIAL (remote verification)

Provider, endpoint, model and temperature are in `config/simulation.json`; operator settings are editable in the UI. A bounded async queue uses one decision request at a time, maximum six pending jobs, timeout, validation and Utility fallback. Models can return only legal simulation actions/targets plus short dialogue and a public reason. Unexpected fields, illegal actions and invalid targets are rejected.

The inspected local qwen2.5:1.5b model returned a schema-valid response; it was actually applied to an agent (`decisionSource: llm`). The same provider generated historian narration after a full match. Evidence: `docs/qa/ollama-results.json`. A cold request took about 20 seconds, so the default timeout is 30 seconds.

Remote compatible calls are implemented, but no remote credential-backed service was used during QA. That provider remains **PARTIAL** in terms of live verification. Hidden chain-of-thought is neither requested nor displayed. API keys are backend environment values only.

## 8. How to run — COMPLETED

1. Double-click **`Start-Society.cmd`** for the browser version; **`Stop-Society.cmd`** stops that launcher-managed server.
2. Or run `npm ci`, `npm run build`, `npm start`, then open `http://127.0.0.1:4310`.
3. For hot reload: `npm run dev`, then `http://127.0.0.1:5173`.
4. Packaged Windows app: `builds/win-unpacked/AI Survival Society.exe`; keep the entire folder together.
5. Portable app: `builds/AI-Survival-Society-1.0.0.exe`.

Default mode runs without a model. Continuous mode starts a new seed 35 seconds after the winner screen, retaining the most recent 30 runs. Persistence is in the project for browser mode and Electron userData for desktop mode.

## 9. How to build — COMPLETED

`npm run build` creates the browser client. `npm run build:desktop` creates an unpacked Windows desktop distribution. `npm run build:portable` creates a single portable executable. `npm run assets` rebuilds the Blender art on the inspected machine; `BLENDER_PATH` can override the executable path.

The first ASAR build failed local startup/integrity checks. The release uses unpacked application resources. Code signing is not configured; portable cold extraction can take about a minute. The built desktop renderer was launched and checked for a real 3D canvas; final operation evidence is under `docs/qa/desktop-results.json`.

## 10. Web deployment status — COMPLETED (local build), NOT IMPLEMENTED (public hosting)

The full browser version runs from the Node server and was tested at desktop and mobile widths. It is WebGL-ready through Three.js; Unity WebGL build targets do not apply.

No public website has been deployed. A static host alone is insufficient because the simulation is authoritative on the backend. `docs/DEPLOYMENT.md` explains same-origin HTTP/WebSocket deployment, HTTPS, server secrets and persistent storage. A Docker recipe is provided but was not built/tested locally (**PARTIAL**). Public multi-user authentication/rate limiting is **NOT IMPLEMENTED**; trusted local operation is the release scope.

## 11. Git status — COMPLETED

Git was initialized before implementation, with separate setup, simulation/model, world/UI/assets and QA/release stages. Ignore rules exclude node_modules, runtime saves/logs, builds, caches, model weights and `.env`; only the variable-name template is tracked. Source, configs and editable art are retained. The repository scanner reports no secret signatures or forbidden runtime/weight paths.

Final branch is `main`; the final commit and remote comparison are verified during finalization. Build outputs are local artifacts/release attachments, not Git source files.

## 12. GitHub status — COMPLETED

Private repository created and verified: **https://github.com/oliverchenOVO/ai-survival-society**. The existing authenticated GitHub CLI was used, without exposing or bypassing credentials. The main branch has been pushed and its remote commit compared successfully with the local commit. A private v1.0.0 release with the verified portable executable is finalized alongside this report.

## 13. Known limitations

- **PARTIAL — Replay:** sampled positions/HP/alive/actions and event timeline; inspector memory/relationships/inventory use final saved state. It is not deterministic 3D replay or full historical checkpoints.
- **PARTIAL — Navigation:** agents move continuously over the island height function, with no obstacle-aware NavMesh/pathfinding. Decorative buildings/trees do not block them.
- **PARTIAL — Animation/art:** consistent procedural low-poly style and animated locomotion/effects; no full skeletal rigs or cinematic production assets.
- **PARTIAL — Remote models:** adapter implemented, external credentialed endpoint not exercised.
- **PARTIAL — Optional audio:** ambient and important event/combat tones implemented; no separate dedicated UI-click sound.
- **NOT IMPLEMENTED — Public hosting/multi-user accounts/code signing/other desktop OS builds.**
- Model-generated narration can embellish; authoritative counters and event logs remain the evidence. High simulation speeds can make model suggestions stale, so Utility AI remains the fallback.
- No literal five-hour wall-clock soak was completed before delivery. Repeated full runs and accelerated continuous-mode/retention tests passed. The computer must stay awake for continuous operation.
- Three.js loads as a deferred larger chunk; the build warning reflects the rendering library, not a runtime error.

## 14. Suggested next improvements

Terrain-aware pathfinding and collisions; full replay state checkpoints; clearer spatial name separation for crowded encounters; richer economic incentives/factions; bilingual UI; authenticated public sessions; signed distributables; broader browser/OS compatibility tests.

## Final acceptance evidence

- `npm test`: 10 tests passed, including schema/timeout/seed/memory/combat/environment/HTTP/persistence/continuous-mode retention.
- `npm run test:simulation`: 20/20 completed, with varied cooperation/conflict/alliances/betrayals.
- `npm run test:ui`: 15 grouped real workflows passed; desktop 1600×1000 and mobile 390×844; no page/console/asset/API failures.
- Local model decision applied and model historian generated; fallback paths tested independently.
- Real screenshots, full example run and demonstration video under `docs/`.
- Source requirement trace: `docs/ORIGINAL_REQUIREMENTS.txt` and `REQUIREMENTS_CHECKLIST.md`.

Final desktop verification: both unpacked and actual portable executable passed launch, real canvas, pause/resume/restart and selection. The unpacked app additionally passed renderer sandbox/context-isolation checks. Portable uses the same app and confirmed no renderer Node access; its NSIS wrapper was verified through Chromium DevTools because it does not forward debugger stderr. Cold portable extraction takes approximately one minute, so the unpacked build is preferable for immediate local startup.

Launcher verification: real Start-Society.ps1 startup, second startup without duplicate process, Stop-Society.ps1 and fresh restart all passed. Production server was left running at http://127.0.0.1:4310 in continuous mode.

Private GitHub release: https://github.com/oliverchenOVO/ai-survival-society/releases/tag/v1.0.0

Portable SHA-256: `4EA4FB4F545D617CB039131E04FDF4699D2F2573B908273CAFBFB5628AD5C681`.

Final clean Git status and local/remote main equality are verified after the final acceptance commit. Optional public hosting, Docker execution, remote credentialed model verification and frame-perfect replay remain explicitly limited as described above.
