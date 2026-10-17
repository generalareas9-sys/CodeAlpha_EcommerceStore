(() => {
  const cartContent = document.querySelector('#cart-content');
  const checkoutContent = document.querySelector('#checkout-content');
  if (!cartContent && !checkoutContent) return;

  const { getCart, saveCart, money, escapeHtml, showToast } = window.Store;

  function summary(items) {
    const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    return `
      <aside class="order-summary">
        <h2>Order summary</h2>
        <div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
        <div class="summary-line"><span>Shipping</span><span>Calculated at checkout</span></div>
        <div class="summary-line summary-total"><span>Total</span><strong>${money(subtotal)}</strong></div>
      </aside>
    `;
  }

  function renderCart(items) {
    if (!items.length) {
      cartContent.innerHTML = '<div class="empty-state"><h2>Your bag is taking a little break.</h2><p>There is plenty to discover in the collection.</p><a class="button button-dark" href="/">Explore the shop</a></div>';
      return;
    }

    cartContent.innerHTML = `
      <div class="cart-layout">
        <div class="cart-items">
          ${items.map((item) => `
            <article class="cart-row" data-product-id="${item.id}">
              <a class="cart-thumb" href="/product.html?id=${item.id}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}"></a>
              <div class="cart-item-copy">
                <h2><a href="/product.html?id=${item.id}">${escapeHtml(item.name)}</a></h2>
                <p>${money(item.priceCents)}</p>
                <div class="quantity-control">
                  <label class="sr-only" for="quantity-${item.id}">Quantity for ${escapeHtml(item.name)}</label>
                  <button type="button" data-action="decrease" aria-label="Decrease quantity">−</button>
                  <input id="quantity-${item.id}" type="number" min="1" max="${item.stock}" value="${item.quantity}">
                  <button type="button" data-action="increase" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <strong class="cart-line-total">${money(item.priceCents * item.quantity)}</strong>
              <button type="button" class="remove-button" data-action="remove">Remove</button>
            </article>
          `).join('')}
        </div>
        <div>${summary(items)}<a class="button button-dark button-full" href="/checkout.html">Continue to checkout</a></div>
      </div>
    `;

    cartContent.querySelectorAll('.cart-row').forEach((row) => {
      const id = Number(row.dataset.productId);
      const input = row.querySelector('input');
      const update = async (quantity) => {
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(input.max)) {
          showToast('Choose a quantity that is in stock.', true);
          input.value = items.find((item) => item.id === id).quantity;
          return;
        }
        const updated = items.map((item) => item.id === id ? { ...item, quantity } : item);
        try {
          await saveCart(updated);
          renderCart(await getCart());
        } catch (error) {
          showToast(error.message, true);
        }
      };

      input.addEventListener('change', () => update(Number(input.value)));
      row.querySelector('[data-action="decrease"]').addEventListener('click', () => update(Number(input.value) - 1));
      row.querySelector('[data-action="increase"]').addEventListener('click', () => update(Number(input.value) + 1));
      row.querySelector('[data-action="remove"]').addEventListener('click', async () => {
        try {
          await saveCart(items.filter((item) => item.id !== id));
          renderCart(await getCart());
        } catch (error) {
          showToast(error.message, true);
        }
      });
    });
  }

  async function initializeCart() {
    if (!cartContent) return;
    await window.Store.ready;
    try {
      renderCart(await getCart());
    } catch (error) {
      if (error.status === 401) {
        window.location.href = `/login.html?next=${encodeURIComponent('/cart.html')}`;
        return;
      }
      cartContent.innerHTML = `<div class="empty-state"><h2>Your bag couldn't be loaded.</h2><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  async function initializeCheckout() {
    if (!checkoutContent) return;
    await window.Store.ready;
    if (!window.Store.currentUser) {
      window.location.href = `/login.html?next=${encodeURIComponent('/checkout.html')}`;
      return;
    }
    try {
      const items = await getCart();
      if (!items.length) {
        checkoutContent.innerHTML = '<div class="empty-state"><h2>Your bag is empty.</h2><a class="button button-dark" href="/">Explore the shop</a></div>';
        return;
      }
      checkoutContent.innerHTML = `
        <div class="checkout-layout">
          <form id="checkout-form" class="form-stack checkout-form">
            <h2>Delivery details</h2>
            <label>Full name<input name="name" autocomplete="name" required minlength="2" maxlength="100" value="${escapeHtml(window.Store.currentUser?.name || '')}"></label>
            <label>Delivery address<textarea name="address" autocomplete="street-address" required minlength="8" maxlength="300" rows="3"></textarea></label>
            <label>Phone number<input name="phone" type="tel" autocomplete="tel" required minlength="7" maxlength="25"></label>
            <p class="form-message" id="checkout-message" role="alert"></p>
            <button class="button button-dark" type="submit">Place order</button>
          </form>
          <div>
            ${summary(items)}
            <div class="checkout-items">${items.map((item) => `<p>${escapeHtml(item.name)} <span>× ${item.quantity}</span><strong>${money(item.priceCents * item.quantity)}</strong></p>`).join('')}</div>
          </div>
        </div>
      `;

      document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.querySelector('#checkout-message');
        const button = form.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());
        button.disabled = true;
        button.textContent = 'Placing your order…';
        message.textContent = '';
        try {
          const result = await window.Store.request('/api/orders', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          window.location.href = `/confirmation.html?id=${result.orderId}`;
        } catch (error) {
          message.textContent = error.message;
          button.disabled = false;
          button.textContent = 'Place order';
        }
      });
    } catch (error) {
      if (error.status === 401) {
        window.location.href = `/login.html?next=${encodeURIComponent('/checkout.html')}`;
        return;
      }
      checkoutContent.innerHTML = `<div class="empty-state"><h2>Checkout couldn't be loaded.</h2><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeCart();
    initializeCheckout();
  });
})();
