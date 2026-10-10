# One image for both the web app and the background worker (compose picks the command).
FROM node:24-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

# Chromium + the system libraries it needs — the scraper falls back to a real browser for JS-rendered pages.
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

COPY . .

# env.ts validates MONGODB_URI at import time, which `next build` triggers while collecting route data.
# Real values come from docker-compose at runtime.
RUN MONGODB_URI=mongodb://build-placeholder/db npm run build

ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "run", "start"]
