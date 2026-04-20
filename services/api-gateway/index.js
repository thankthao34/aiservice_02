const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const USER_URL = process.env.USER_URL || 'http://localhost:3001';
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:3002';
const ORDER_URL = process.env.ORDER_URL || 'http://localhost:3003';
const AI_URL = process.env.AI_URL || 'http://localhost:8000';

app.use(cors());

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'api-gateway' });
});

app.use('/api/users', createProxyMiddleware({ target: USER_URL, changeOrigin: true, pathRewrite: { '^/api/users': '' } }));
app.use('/api/products', createProxyMiddleware({ target: PRODUCT_URL, changeOrigin: true, pathRewrite: { '^/api/products': '' } }));
app.use('/api/orders', createProxyMiddleware({ target: ORDER_URL, changeOrigin: true, pathRewrite: { '^/api/orders': '' } }));
app.use('/api/ai', createProxyMiddleware({ target: AI_URL, changeOrigin: true, pathRewrite: { '^/api/ai': '' } }));

app.listen(port, () => {
  console.log(`API Gateway running on ${port}`);
});
