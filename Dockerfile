FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npm run build
ENV DATA_DIR=/app/data UPLOAD_DIR=/app/uploads PORT=3001
RUN mkdir -p /app/data /app/uploads
EXPOSE 3001
CMD ["node", "server/index.js"]
