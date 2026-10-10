FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY warframe.js ./
COPY config.json ./

CMD ["node", "index.js"]
