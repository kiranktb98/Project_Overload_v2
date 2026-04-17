FROM node:20-slim

RUN npm install -g pnpm@10.16.1

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "--filter", "@project-overload/web", "start"]
