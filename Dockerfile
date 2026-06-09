# syntax=docker/dockerfile:1

# ---- build stage: compile the Vite/React app to static files ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps from the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Build (tsc -b && vite build) -> /app/dist
COPY . .
RUN npm run build

# ---- serve stage: tiny nginx serving the built SPA ----
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
