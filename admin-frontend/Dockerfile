# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 5174
CMD ["npm", "run", "dev"]

# The independent static bundle is copied into the production reverse proxy.
FROM base AS build
COPY . .
RUN npm run build
