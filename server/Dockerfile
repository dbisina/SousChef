# syntax=docker/dockerfile:1
# Build context is the repository root (the server imports ../shared).
#
#   docker build -f server/Dockerfile --target runtime -t souschef-server .
#
# Targets: native (Rust addon) -> build (compile) -> runtime (what runs in production).
# `dev` is the same toolchain with the source mounted by docker-compose.

ARG NODE_VERSION=22

# ---------------------------------------------------------------- native: compile the Rust addon
FROM node:${NODE_VERSION}-bookworm AS native
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:${PATH}
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
WORKDIR /app/server
COPY server/scripts scripts
COPY server/native native
# Unit tests run here, so a broken link parser fails the image build.
RUN cd native && cargo test --workspace
RUN node scripts/build-native.mjs

# ---------------------------------------------------------------- build: install, generate the database client, compile
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
# The addon must exist before npm install: package.json points at it with file:./native.
COPY --from=native /app/server/native ./native
RUN npm ci
COPY shared /app/shared
COPY server/tsconfig.json server/tsup.config.ts server/prisma.config.ts server/eslint.config.js server/vitest.config.ts ./
COPY server/prisma ./prisma
COPY server/src ./src
COPY server/test ./test
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------- dev: source is mounted over /app/server/src by compose
FROM build AS dev
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------- runtime: production dependencies and the compiled app only
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
COPY --from=native /app/server/native ./native
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
USER node
EXPOSE 3000
# The memory cap lives in the start script (--max-old-space-size).
CMD ["npm", "run", "start"]

# ---------------------------------------------------------------- migrate: applies database migrations, then exits (the production compose file runs it before the API)
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]
