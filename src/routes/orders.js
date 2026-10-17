const express = require('express');
const db = require('../db/database');
const HttpError = require('../utils/http-error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/', (request, response, next) => {
  try {
    const { name, address, phone } = request.body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      throw new HttpError(400, 'Enter a name between 2 and 100 characters.');
    }
    if (typeof address !== 'string' || address.trim().length < 8 || address.trim().length > 300) {
      throw new HttpError(400, 'Enter an address between 8 and 300 characters.');
    }
    if (typeof phone !== 'string' || !/^[+()\-\s\d]{7,25}$/.test(phone.trim())) {
      throw new HttpError(400, 'Enter a valid phone number.');
    }

    const placeOrder = db.transaction(() => {
      const items = db.prepare(`
        SELECT p.id, p.name, p.image_url, p.price_cents, p.stock, c.quantity
        FROM cart_items c
        JOIN products p ON p.id = c.product_id
        WHERE c.user_id = ?
      `).all(request.user.id);

      if (!items.length) {
        throw new HttpError(400, 'Your cart is empty.');
      }

      for (const item of items) {
        if (item.quantity > item.stock) {
          throw new HttpError(409, `${item.name} does not have enough stock. Update your cart and try again.`);
        }
      }

      const totalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
      const orderResult = db.prepare(`
        INSERT INTO orders (user_id, customer_name, address, phone, total_cents)
        VALUES (?, ?, ?, ?, ?)
      `).run(request.user.id, name.trim(), address.trim(), phone.trim(), totalCents);

      const orderId = Number(orderResult.lastInsertRowid);
      const insertOrderItem = db.prepare(`
        INSERT INTO order_items
          (order_id, product_id, product_name, image_url, unit_price_cents, quantity)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const reduceStock = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?
      `);

      for (const item of items) {
        insertOrderItem.run(
          orderId, item.id, item.name, item.image_url, item.price_cents, item.quantity,
        );
        const result = reduceStock.run(item.quantity, item.id, item.quantity);
        if (result.changes !== 1) {
          throw new HttpError(409, `${item.name} just sold out. Please review your cart.`);
        }
      }

      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(request.user.id);
      return orderId;
    });

    const orderId = placeOrder();
    response.status(201).json({ orderId });
  } catch (error) {
    next(error);
  }
});

router.get('/my', (request, response) => {
  const orders = db.prepare(`
    SELECT id, customer_name AS customerName, total_cents AS totalCents,
      status, created_at AS createdAt
    FROM orders WHERE user_id = ?
    ORDER BY id DESC
  `).all(request.user.id);
  response.json({ orders });
});

router.get('/:id', (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return next(new HttpError(400, 'Order ID must be a positive number.'));
  }

  const order = db.prepare(`
    SELECT id, customer_name AS customerName, address, phone,
      total_cents AS totalCents, status, created_at AS createdAt
    FROM orders WHERE id = ? AND user_id = ?
  `).get(id, request.user.id);

  if (!order) {
    return next(new HttpError(404, 'Order not found.'));
  }

  const items = db.prepare(`
    SELECT product_id AS productId, product_name AS name, image_url AS imageUrl,
      unit_price_cents AS priceCents, quantity
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(id);

  return response.json({ order: { ...order, items } });
});

module.exports = router;
