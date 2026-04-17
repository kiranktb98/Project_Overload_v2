FROM node:20-slim

# Chromium for puppeteer-core PDF rendering
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

RUN npm install -g pnpm@10.16.1

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 4000
CMD ["pnpm", "--filter", "@project-overload/api", "start"]
