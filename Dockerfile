FROM golang:1.27-alpine AS api-build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/sku-portal .

FROM gcr.io/distroless/static-debian12:nonroot AS api
COPY --from=api-build /out/sku-portal /sku-portal
ENTRYPOINT ["/sku-portal"]

FROM oven/bun:1 AS web-build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json metadata.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server.ts ./
COPY --from=web-build /app/dist ./dist
USER bun
CMD ["bun", "server.ts"]
