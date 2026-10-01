# Environment inspection — 2026-10-02 (Asia/Taipei)

| Tool | Result |
|---|---|
| Unity Editor | D:/unity/6000.2.0f1/Editor/Unity.exe |
| Unity Hub | D:/unity/Unity Hub/Unity Hub.exe |
| Unity targets | WebGLSupport and windowsstandalonesupport installed |
| Blender / bpy | Blender 3.1.2, C:/Program Files/Blender Foundation/Blender 3.1/blender.exe; Python API verified during asset generation |
| Git / LFS | Git 2.54.0, LFS 3.7.1 |
| GitHub CLI | Installed, authenticated as oliverchenOVO with repo scope |
| Python / Conda | Python 3.11.7, Anaconda installed |
| Node / npm / pnpm | Node v24.13.0, npm 11.6.2, pnpm available |
| .NET | Host installed; no SDK reported |
| Visual Studio / Build Tools | Legacy VS 10.0 and MSBuild directories; modern compiler not established |
| FFmpeg | Installed on PATH |
| GPU / CUDA | RTX 3070 Laptop, 8GB, driver 610.88, CUDA runtime 13.3 reported; CUDA toolkit not required |
| Ollama | Running at localhost:11434 |
| Local models | qwen2.5:1.5b, qwen2.5:7b, qwen3.5:9b-q4_K_M, deepseek-r1:8b |
| LM Studio | Not found in standard install path; localhost:1234 unavailable |
| Other engines | Godot absent on PATH; Epic launchers installed |
| Existing project | Empty directory, no prior remote; Git initialized before implementation |

## Architecture choice

Three.js + React + Node.js, with Electron desktop packaging and Blender-authored procedural robot GLB. Unity is available, but a common browser/desktop client gives a smaller, directly reproducible build and avoids two independently tested presentation targets. The server owns authoritative simulation, persistence and model credentials. Both desktop and browser clients use the same HTTP/WebSocket protocol. Blender supplies genuine reusable source and export assets; the island is generated at runtime from the same seed as the simulation.

Browser plugin/skill is not available in this session; rendered QA will use Playwright. The native CUA browser is available for showing the finished app.
