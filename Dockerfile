## syntax=docker/dockerfile:1

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.0.0
ARG INSECURE_TLS=0

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS builder
ARG PNPM_VERSION
ARG CUSTOM_CA_CERT_BASE64
ARG INSECURE_TLS
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN if [ -n "$CUSTOM_CA_CERT_BASE64" ]; then echo "$CUSTOM_CA_CERT_BASE64" | base64 -d > /usr/local/share/ca-certificates/custom_ca.crt && update-ca-certificates; fi
RUN if [ "$INSECURE_TLS" = "1" ]; then export NODE_TLS_REJECT_UNAUTHORIZED=0; export NPM_CONFIG_STRICT_SSL=false; fi \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN if [ "$INSECURE_TLS" = "1" ]; then export NODE_TLS_REJECT_UNAUTHORIZED=0; export NPM_CONFIG_STRICT_SSL=false; fi && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data/openclaw && chown -R node:node /data
USER node

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]




