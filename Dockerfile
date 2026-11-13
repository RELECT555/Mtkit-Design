FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/catalog/package.json packages/catalog/
COPY packages/mcp/package.json packages/mcp/
RUN npm ci --no-audit --no-fund
COPY packages/catalog/ packages/catalog/
COPY packages/mcp/ packages/mcp/
COPY scripts/build-catalog.mjs scripts/
COPY tsconfig.json ./
RUN npm run catalog:check && npm run catalog:build && npm run catalog:smoke

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/plugins/mtkit-design/dist/ ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})"]
CMD ["node", "catalog.cjs", "--hosted"]
