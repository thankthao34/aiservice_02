FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/db
EXPOSE 3003
CMD ["node", "index.js"]
