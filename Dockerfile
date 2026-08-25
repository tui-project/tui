FROM node:26-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install --global pnpm@11.22.0

# ---- build stage ----
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm nuxt prepare && NODE_OPTIONS=--max-old-space-size=3072 pnpm nuxt build

# ---- runner stage ----
FROM mwader/static-ffmpeg:9.0 AS ffmpeg

FROM node:26-alpine AS runner
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
