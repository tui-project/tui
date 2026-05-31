FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

# ---- build stage ----
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --config.dangerously-allow-all-builds=true
COPY . .
RUN pnpm nuxt prepare && NODE_OPTIONS=--max-old-space-size=3072 pnpm nuxt build

# ---- runner stage ----
FROM mwader/static-ffmpeg:8.1.1 AS ffmpeg

FROM node:22-alpine AS runner
RUN apk add --no-cache mediainfo
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe
WORKDIR /app
COPY --from=build /app/.output ./

VOLUME /app/config

ENV HOST=0.0.0.0
ENV PORT=4000

EXPOSE 4000

CMD ["node", "server/index.mjs"]
