FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npx esbuild scripts/collector_job.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/collector.cjs && npx esbuild scripts/verify_runtime_identity.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/verify-identity.cjs
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/data/redevelopment ./data/redevelopment
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
