# AGENTS.md

SolidJS + Vite single-page dashboard that monitors/controls an ESP32 "ComfortRoom" device over MQTT. This repo contains only the web UI and a telemetry simulator — no backend, no firmware.

## Commands

- `npm install` (lockfile is committed; `npm ci` for a clean install)
- `npm run dev` — Vite dev server on **port 8080**
- `npm run build` — static bundle in `dist/` (`base: "./"`, deployable anywhere)
- `npm run preview` — serve the built bundle on port 8080
- `npm run simulate` — publish fake telemetry (see below)
- `podman build -t cr-dashboard .` (or `docker build -f Containerfile -t cr-dashboard .`) — multi-stage build, then `podman run --rm -p 8080:8080 cr-dashboard` for a production nginx serve
- `podman build --target dev -t cr-dashboard-dev .` — Vite dev server image; bind-mount `src`, `index.html`, and `vite.config.js` at run time for hot reload (see README)
- `podman compose --profile dev up --build` / `podman compose --profile production up --build` — start the included Mosquitto broker plus the corresponding dashboard; requires `podman-compose` or `docker-compose`

There is **no test, lint, typecheck, or format script**. Verify changes with the dev server + simulator, or at minimum `npm run build`. Vite 8 requires Node `^20.19.0 || >=22.12.0`.

## MQTT contract

All topics are rooted at `<deviceId>/room/`. The dashboard subscribes to `<deviceId>/room/#`.

Device → dashboard:
- `temperature`, `humidity`, `light` — numeric
- `motion` — `ON` / `OFF`
- `status` — `NORMAL` / `HOT` / `ENERGY_WASTE`
- `availability` — `online` / `offline`
- `ack` — `command|OK|detail` or `command|ERR|CODE` (`CODE` values live in `ERROR_TEXT`)

Dashboard → device: `<deviceId>/room/control/<command>` with commands `buzzer` (ON/OFF), `silence` (ON), `publish` (ON/OFF), `temp_threshold`, `interval`, `motion_hold`, `light_threshold`.

Commands use QoS 0 and carry a **6 s ack timeout** (`ACK_TIMEOUT_MS`). UI state for a setting changes only after an `OK` ack (`applyConfirmedState` in `App.jsx`); keep that pattern when adding controls.

## Simulator gotchas

- The simulator uses plain TCP `mqtt://127.0.0.1:1883` (`MQTT_URL` override). The dashboard defaults to WebSocket `ws(s)://<page-hostname>:9001/mqtt`. One broker must expose **both** listeners for the UI and simulator to meet; `mosquitto.conf` does this.
- The simulator only publishes telemetry/availability/status. It does **not** subscribe to control topics or send acks, so control buttons will report "No acknowledgement" unless real firmware is connected. That is expected — do not "fix" it by changing the ack timeout.
- The dashboard and simulator share the same default device ID, duplicated in `src/constants.js`, `scripts/simulate.mjs`, and the `compose.yaml` simulator default; change all three together.
- Simulator env vars: `DEVICE_ID`, `INTERVAL_MS`, `TEMP_THRESHOLD`, `LIGHT_THRESHOLD`, `MOTION_HOLD_MS`.

## Architecture

- Entry: `src/index.jsx` → `src/App.jsx`. `App.jsx` holds all MQTT connection and state logic in a single `createStore`; components in `src/components/` are presentational.
- `src/constants.js` contains storage key, thresholds, command/status/error labels, and the default broker URL (derived from `window.location`: port `9001`, path `/mqtt`).
- Settings (broker URL, device ID) persist in `localStorage` under `comfortroom.dashboard.v2`, and the app **auto-connects on mount** using them.
- `compose.yaml`/`mosquitto.conf` provide a local Eclipse Mosquitto broker (anonymous, dev-only) and profile-gated `dashboard` (`production`), `dashboard-dev` + `simulator` (`dev`). The container serves only static files; the broker is a separate service.
- Styling is one global `src/styles.css` with semantic class names and `data-*` state attributes. No CSS framework or CSS modules. Chart colors come from CSS variables (`--temp`, `--humidity`, `--light`).
- Plain JavaScript ESM (`"type": "module"`), no TypeScript and no path aliases. Files are `.jsx` with Solid reactivity (`createSignal`, `createStore`, `createMemo`); use `class`/`for` attributes, not React's `className`/`htmlFor`.
