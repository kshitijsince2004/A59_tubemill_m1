# Multi-stage production image for A-59 Tube Mill M1
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY babel.build.cjs ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install

COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build -w shared && npm run build -w server && npm run build -w client

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV AUTH_MODE=static
ENV COLLECTOR_MODE=sim
ENV CORS_ORIGIN=same-origin
ENV PORT=3001

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --omit=dev

COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY server/migrations ./server/migrations
COPY server/seeds ./server/seeds
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
