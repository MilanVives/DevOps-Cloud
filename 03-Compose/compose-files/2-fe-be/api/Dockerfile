FROM node:22-alpine
WORKDIR /app

# Eerst enkel package*.json: zolang die niet wijzigen, hergebruikt Docker de npm install-laag
COPY package*.json ./
RUN npm ci --omit=dev

# Daarna pas de code
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
