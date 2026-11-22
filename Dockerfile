# Gobbler Plan: two-stage image. Stage 1 builds the static planner with Node; stage 2 serves it with nginx.
# Build:  docker build -t gobbler-plan .
# Run:    docker run --rm -p 8080:8080 gobbler-plan   then open http://localhost:8080

FROM node:24-alpine AS build
WORKDIR /app
# One runtime package is needed in the image: the in-browser model library, copied into the site by the build.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY scripts ./scripts
COPY data ./data
COPY assets ./assets
# Public build only. Grade CSVs are kept out by .dockerignore, and --grades is never passed here.
RUN node scripts/build-site.ts

# Runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
