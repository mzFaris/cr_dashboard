# ComfortRoom Dashboard

SolidJS + Vite dashboard for the ComfortRoom ESP32 room monitor. It connects to MQTT over WebSocket.

## Development

Start the broker, Vite dev server, and simulator:

```bash
podman compose --profile dev up --build
```

Open <http://localhost:8080>.

Or build and run the dev image directly:

```bash
podman build --target dev -t cr-dashboard-dev .
podman run --rm -p 8080:8080 \
  -v "$PWD/src:/app/src:Z" \
  -v "$PWD/index.html:/app/index.html:Z" \
  -v "$PWD/vite.config.js:/app/vite.config.js:Z" \
  cr-dashboard-dev
```

Start the broker separately:

```bash
podman run -d --name comfortroom-mosquitto \
  -p 1883:1883 -p 9001:9001 \
  -v "$PWD/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro,Z" \
  -v comfortroom-mosquitto-data:/mosquitto/data \
  docker.io/library/eclipse-mosquitto:2
```

## Production

Build and run the static image:

```bash
podman build --target production -t cr-dashboard .
podman run --rm -p 8080:8080 cr-dashboard
```

Or run broker and dashboard together:

```bash
podman compose --profile production up --build
```

With Docker, use `docker build -f Containerfile` and drop the `:Z` suffixes.

`podman compose` requires `podman-compose` or `docker-compose` to be installed. The dashboard expects the broker at `ws://<host>:9001/mqtt`; the app image itself does not include a broker.
