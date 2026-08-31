FROM oven/bun:1.3.0-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY server server
RUN bun run --cwd server build

FROM dependencies AS migration
COPY server server
WORKDIR /app/server
CMD ["bun", "run", "db:migrate"]

FROM oven/bun:1.3.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/server/dist ./server/dist
USER bun
EXPOSE 3000
CMD ["bun", "server/dist/index.js"]
