FROM node:22-alpine AS dependencies

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/demo-site/package.json apps/demo-site/package.json
RUN pnpm install --frozen-lockfile

COPY . .

FROM dependencies AS api-build
RUN pnpm --filter api build

FROM node:22-alpine AS api

ENV NODE_ENV=production
WORKDIR /app

COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM dependencies AS web-build

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter web build

FROM nginx:1.27-alpine AS web

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

FROM dependencies AS demo-build
RUN pnpm --filter demo-site build

FROM node:22-alpine AS demo

ENV NODE_ENV=production
WORKDIR /app

COPY --from=demo-build /app/node_modules ./node_modules
COPY --from=demo-build /app/apps/demo-site/node_modules ./apps/demo-site/node_modules
COPY --from=demo-build /app/apps/demo-site/dist ./apps/demo-site/dist
COPY --from=demo-build /app/apps/demo-site/server.mjs ./apps/demo-site/server.mjs

WORKDIR /app/apps/demo-site
EXPOSE 5174
CMD ["node", "server.mjs"]

