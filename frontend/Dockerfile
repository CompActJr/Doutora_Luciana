FROM node:24.22.2-bookworm-slim AS dependencies
COPY --from=ghcr.io/pnpm/pnpm:12.18.0 /opt/pnpm /opt/pnpm
ENV PNPM_HOME=/pnpm
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=dra-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM dependencies AS source
COPY . .

FROM source AS development
CMD ["pnpm", "run", "dev:frontend"]

FROM source AS build
RUN pnpm --filter @dra/frontend run build

FROM node:24.22.2-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
