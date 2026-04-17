FROM node:20-slim

RUN npm install -g pnpm@10.16.1

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--filter", "@project-overload/worker", "start"]
