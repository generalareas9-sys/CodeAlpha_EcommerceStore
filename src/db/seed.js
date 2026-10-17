const db = require('./database');

const products = [
  {
    name: 'Everyday Backpack',
    category: 'Accessories',
    description: 'A lightweight everyday backpack with a padded laptop sleeve, roomy compartments, and comfortable adjustable straps.',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85',
    priceCents: 5499,
    stock: 24,
  },
  {
    name: 'Classic Ceramic Mug',
    category: 'Home',
    description: 'A sturdy ceramic mug for slow mornings and afternoon coffee. Holds 350 ml and is dishwasher safe.',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85',
    priceCents: 1899,
    stock: 40,
  },
  {
    name: 'Wireless Headphones',
    category: 'Electronics',
    description: 'Comfortable wireless headphones with clear sound, soft over-ear cushions, and up to 30 hours of listening.',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85',
    priceCents: 8999,
    stock: 18,
  },
  {
    name: 'Linen Table Lamp',
    category: 'Home',
    description: 'A warm, minimalist table lamp with a linen shade to bring a soft glow to desks, shelves, and bedside tables.',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85',
    priceCents: 4299,
    stock: 12,
  },
  {
    name: 'Canvas Market Tote',
    category: 'Accessories',
    description: 'A reusable heavy-canvas tote with reinforced handles, made for errands, books, and everyday essentials.',
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85',
    priceCents: 2499,
    stock: 32,
  },
  {
    name: 'Insulated Water Bottle',
    category: 'Lifestyle',
    description: 'A leak-resistant stainless steel bottle that keeps drinks cold for 24 hours or hot for 12.',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85',
    priceCents: 2799,
    stock: 28,
  },
  {
    name: 'Desk Notebook Set',
    category: 'Stationery',
    description: 'A set of two lay-flat notebooks with smooth, responsibly sourced paper for plans, lists, and ideas.',
    imageUrl: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85',
    priceCents: 1599,
    stock: 50,
  },
  {
    name: 'Soft Cotton Throw',
    category: 'Home',
    description: 'A breathable cotton throw with a subtle woven texture that adds comfort to a sofa or reading chair.',
    imageUrl: 'https://images.unsplash.com/photo-1600369671236-e74521d4b6ad?auto=format&fit=crop&w=900&q=85',
    priceCents: 3999,
    stock: 16,
  },
  {
    name: 'Everyday Sunglasses',
    category: 'Accessories',
    description: 'A timeless lightweight frame with UV400 lenses and a handy protective storage case.',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85',
    priceCents: 3499,
    stock: 20,
  },
  {
    name: 'Compact Bluetooth Speaker',
    category: 'Electronics',
    description: 'A pocket-sized Bluetooth speaker with balanced sound, simple controls, and splash-resistant construction.',
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85',
    priceCents: 6499,
    stock: 14,
  },
];

const insertProduct = db.prepare(`
  INSERT INTO products (name, description, category, image_url, price_cents, stock)
  SELECT @name, @description, @category, @imageUrl, @priceCents, @stock
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = @name)
`);

const seedProducts = db.transaction(() => {
  for (const product of products) {
    insertProduct.run(product);
  }
});

seedProducts();
console.log(`Seed complete. ${products.length} sample products are available.`);
db.close();
