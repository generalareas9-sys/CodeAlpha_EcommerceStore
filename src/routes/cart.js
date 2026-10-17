const express = require('express');
const db = require('../db/database');
const HttpError = require('../utils/http-error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function readCart(userId) {
  return db.prepare(`
    SELECT p.id, p.name, p.description, p.category, p.image_url AS imageUrl,
      p.price_cents AS priceCents, p.stock, c.quantity
    FROM cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
    ORDER BY p.name
  `).all(userId);
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length > 100) {
    throw new HttpError(400, 'Cart items must be a list of up to 100 products.');
  }

  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'Each cart item must be an object.');
    }
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(productId) || productId < 1
      || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99
      || seen.has(productId)) {
      throw new HttpError(400, 'Each cart item must have a unique product and quantity from 1 to 99.');
    }
    seen.add(productId);
    return { productId, quantity };
  });
}

function saveCart(userId, items) {
  const replaceCart = db.transaction((validatedItems) => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    const insertItem = db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
    `);

    for (const item of validatedItems) {
      const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(item.productId);
      if (!product) {
        throw new HttpError(400, 'A product in your cart is no longer available.');
      }
      if (item.quantity > product.stock) {
        throw new HttpError(400, 'A cart quantity is higher than the available stock.');
      }
      insertItem.run(userId, item.productId, item.quantity);
    }
  });
  replaceCart(items);
}

router.get('/', (request, response) => {
  response.json({ items: readCart(request.user.id) });
});

router.put('/', (request, response, next) => {
  try {
    const items = validateItems(request.body.items);
    saveCart(request.user.id, items);
    response.json({ items: readCart(request.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', (request, response, next) => {
  try {
    const guestItems = validateItems(request.body.items);
    const merged = new Map(readCart(request.user.id).map((item) => [
      item.id,
      { productId: item.id, quantity: item.quantity },
    ]));

    for (const item of guestItems) {
      const existing = merged.get(item.productId);
      merged.set(item.productId, {
        productId: item.productId,
        quantity: Math.min(99, item.quantity + (existing ? existing.quantity : 0)),
      });
    }

    const availableItems = [...merged.values()].filter((item) => {
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.productId);
      return product && product.stock > 0;
    }).map((item) => {
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.productId);
      return { ...item, quantity: Math.min(item.quantity, product.stock) };
    });

    saveCart(request.user.id, availableItems);
    response.json({ items: readCart(request.user.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
