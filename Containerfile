# One Containerfile, two runnable targets:
#   --target dev        Vite dev server with hot reload (bind-mount the source)
#   --target production  static build served by nginx (the default target)
# The intermediate build stage only exists to produce dist/ for production.

# Development server with hot reload. Build with --target dev and bind-mount
# src/, index.html, and vite.config.js over the image contents at run time.
FROM node:22-alpine AS dev
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY scripts ./scripts
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build the static Vite bundle.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# Serve the bundle with nginx.
# The MQTT broker is external: the browser connects to ws://<host>:9001/mqtt
# by default. Users can override it in the dashboard's Settings panel.
FROM nginx:1.28-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
