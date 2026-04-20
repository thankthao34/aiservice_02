FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/db
RUN mkdir -p /app/uploads/products
EXPOSE 3002
CMD ["node", "index.js"]
