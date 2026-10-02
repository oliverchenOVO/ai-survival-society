FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
COPY index.html vite.config.mjs ./
COPY src ./src
COPY core ./core
COPY public ./public
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY core ./core
COPY server ./server
COPY src/i18n ./src/i18n
COPY src/story ./src/story
COPY config ./config
RUN mkdir -p /data/logs /data/saves && chown -R node:node /data /app
ENV HOST=0.0.0.0 PORT=4310 DATA_DIR=/data
USER node
EXPOSE 4310
VOLUME ["/data"]
CMD ["node", "server/index.mjs"]
