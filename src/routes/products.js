const express = require('express');
const db = require('../db/database');
const HttpError = require('../utils/http-error');

const router = express.Router();

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    priceCents: row.price_cents,
    stock: row.stock,
  };
}

router.get('/categories', (request, response) => {
  const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category')
    .all()
    .map((row) => row.category);
  response.json({ categories });
});

router.get('/', (request, response) => {
  const search = typeof request.query.search === 'string'
    ? request.query.search.trim().slice(0, 100)
    : '';
  const category = typeof request.query.category === 'string'
    ? request.query.category.trim().slice(0, 60)
    : '';

  const conditions = [];
  const parameters = [];

  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    parameters.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push('category = ?');
    parameters.push(category);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const products = db.prepare(`
    SELECT id, name, description, category, image_url, price_cents, stock
    FROM products ${whereClause}
    ORDER BY id
  `).all(...parameters).map(formatProduct);

  response.json({ products });
});

router.get('/:id', (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return next(new HttpError(400, 'Product ID must be a positive number.'));
  }

  const product = db.prepare(`
    SELECT id, name, description, category, image_url, price_cents, stock
    FROM products WHERE id = ?
  `).get(id);

  if (!product) {
    return next(new HttpError(404, 'Product not found.'));
  }

  return response.json({ product: formatProduct(product) });
});

module.exports = router;
