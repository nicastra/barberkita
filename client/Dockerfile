FROM oven/bun:1.3.0-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN bun install --frozen-lockfile
COPY client client
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN bun run --cwd client build

FROM nginx:1.27-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
