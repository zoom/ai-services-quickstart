# syntax=docker/dockerfile:1

# ---- build: compile the backend and the playground ----
FROM node:24-slim AS build
WORKDIR /app

# Install deps first for layer caching (dev deps included; tsc/vite need them).
COPY package*.json ./
RUN npm ci
COPY playground/package*.json ./playground/
RUN npm ci --prefix playground

# Sources, then build backend (-> dist) and playground (-> playground/dist).
COPY tsconfig.json ./
COPY src ./src
COPY playground ./playground
RUN npm run build && npm run build --prefix playground

# ---- run: production deps + compiled output only ----
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/playground/dist ./playground/dist

# The app binds process.env.PORT (Railway injects it) and falls back to 4000.
EXPOSE 4000
CMD ["node", "dist/index.js"]
