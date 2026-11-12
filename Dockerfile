FROM node:20 AS deps

WORKDIR /usr/src/app

COPY package*.json ./
# Production dependencies only, resolved from the lockfile.
RUN npm ci --omit=dev

FROM node:20-slim AS runtime

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules
# Includes vendor/tokenizer - the xlm-roberta-base vocabulary is baked into the image so the
# container needs no network access at runtime or at deploy time.
COPY --chown=node:node . .

USER node
EXPOSE 8080
CMD ["node", "index.js"]
