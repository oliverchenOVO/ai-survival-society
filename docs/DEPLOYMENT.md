# Web deployment

Status: browser build completed and tested locally. Public deployment has not been performed. Unity WebGL does not apply to this stack.

The browser and backend must share an origin: serve the built `dist/`, `/api`, and `/ws` through the same Node process or reverse proxy. The simulation runs on the server. GitHub Pages, static Cloudflare Pages, static Netlify and static Vercel alone cannot run that process.

## Node host

Install Node 22.12+; run `npm ci`, `npm run build`, then `npm start`. Bind locally by default. For a container or reverse proxy, set `HOST=0.0.0.0`, `PORT=4310`, and a persistent `DATA_DIR`. Terminate HTTPS at the proxy and forward WebSocket upgrade requests.

The Dockerfile provides a production recipe:

```sh
docker build -t ai-survival-society .
docker run --rm -p 4310:4310 -v society-data:/data ai-survival-society
```

Docker is not required locally. This recipe has not been built/tested on the current machine, where no Docker runtime was established.

## Public operation

This release is a trusted local observatory with shared controls. Before public hosting, protect all `/api` control routes and the app with authentication at the reverse proxy, add rate limiting, and use HTTPS. Model endpoint configuration is an operator setting and should not be exposed to untrusted viewers. A multi-tenant public backend needs separate sessions and per-user access control.

Model credentials belong in the server's `LLM_API_KEY` environment variable or secret manager, never in the browser bundle. For a remote compatible provider configure its `https://.../v1` API base. For Ollama in a container, use a private network endpoint reachable from that container.

The frontend currently connects to the same origin, so no client URL or model credential must be baked into the build. Logs/saves can be moved to a persistent volume. Retention defaults to 30 recent matches.

## Desktop distribution

`npm run build:desktop` creates an unpacked Windows distribution, and `npm run build:portable` a single executable. Desktop starts a loopback server on an ephemeral port and writes data to Electron's userData directory. Shipping the unpacked version requires shipping its entire folder.

The current build uses unpacked application resources because the first local ASAR distribution failed startup and extraction integrity checks. The unpacked rebuild was actually launched and tested. Code signing is not configured, and the portable executable may be flagged as unsigned by Windows.
