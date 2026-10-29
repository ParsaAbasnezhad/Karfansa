# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: Vite dev server, source is bind-mounted by docker compose ------------------------
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build: static files in /app/dist (served by the reverse proxy in production) ----------
FROM base AS build
COPY . .
RUN npm run build
