FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Skip native postinstall hooks (embedded-postgres is dev-only, not needed in cloud)
RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts \
  && npm install prisma@6.5.0 --no-save \
  && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/mini-app/dist ./mini-app/dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
