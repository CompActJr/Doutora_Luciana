FROM node:24.22.2-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY --from=ghcr.io/pnpm/pnpm:12.18.0 /opt/pnpm /opt/pnpm
ENV PNPM_HOME=/pnpm
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=dra-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM dependencies AS source
COPY . .

FROM source AS development
CMD ["pnpm", "run", "dev:backend"]

FROM source AS migrate
# Baixar o schema engine durante o build: a rede do banco não tem saída externa.
RUN pnpm run db:generate && pnpm --filter @dra/backend exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /dev/null
CMD ["pnpm", "run", "db:migrate"]

FROM source AS build
RUN pnpm run db:generate && pnpm --filter @dra/backend run build

FROM build AS production-dependencies
RUN --mount=type=cache,id=dra-pnpm-store,target=/pnpm/store pnpm --filter @dra/backend deploy --prod /out --store-dir=/pnpm/store

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=production-dependencies --chown=node:node /out ./
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
