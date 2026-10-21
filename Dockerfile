# Production image. On start the server applies migrations and creates the
# initial admin (src/server/startup.ts); SQLite lives on the /data volume.

ARG NODE_VERSION=24-bookworm-slim
# Reviewed Node 24 / Debian 13 runtime; update digest only after scan + smoke tests.
ARG NODE_RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && mkdir -p /runtime-data

FROM ${NODE_RUNTIME_IMAGE} AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="Caddy Visualizer" \
      org.opencontainers.image.description="Web UI for a Caddy server: Caddyfile editor, sites, metrics and logs" \
      org.opencontainers.image.source="https://github.com/dree007/caddy-visualizer" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"
WORKDIR /app
ENV PATH=/nodejs/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/caddy-visualizer.db
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
COPY --from=build --chown=1000:1000 /app/drizzle ./drizzle
# No shell/package manager in runtime. Prepare writable volume ownership at build
# time; startup, migrations and diagnostics require only Node, not shell scripts.
COPY --from=build --chown=1000:1000 /runtime-data /data
VOLUME ["/data"]
USER 1000:1000
# Distroless has a Node entrypoint; clear it to preserve `docker run IMAGE node …`.
ENTRYPOINT []
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
