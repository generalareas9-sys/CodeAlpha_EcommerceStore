(() => {
  const listContainer = document.querySelector('#orders-content');
  const confirmationContainer = document.querySelector('#confirmation-content');
  if (!listContainer && !confirmationContainer) return;

  const { request, money, escapeHtml } = window.Store;

  async function loadOrders() {
    if (!listContainer) return;
    await window.Store.ready;
    try {
      const result = await request('/api/orders/my');
      if (!result.orders.length) {
        listContainer.innerHTML = '<div class="empty-state"><h2>No orders just yet.</h2><p>Your next favorite could be waiting in the shop.</p><a class="button button-dark" href="/">Explore the shop</a></div>';
        return;
      }

      listContainer.innerHTML = `
        <div class="orders-list">
          ${result.orders.map((order) => `
            <a class="order-card" href="/confirmation.html?id=${order.id}">
              <span class="order-card-date">Order #${order.id} · ${new Date(`${order.createdAt.replace(' ', 'T')}Z`).toLocaleDateString()}</span>
              <strong>${money(order.totalCents)}</strong>
              <span class="status-pill">${escapeHtml(order.status)}</span>
              <span aria-hidden="true">→</span>
            </a>
          `).join('')}
        </div>
      `;
    } catch (error) {
      if (error.status === 401) {
        window.location.href = `/login.html?next=${encodeURIComponent('/orders.html')}`;
        return;
      }
      listContainer.innerHTML = `<div class="empty-state"><h2>Orders couldn't be loaded.</h2><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  async function loadConfirmation() {
    if (!confirmationContainer) return;
    await window.Store.ready;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      confirmationContainer.innerHTML = '<div class="empty-state"><h2>No order was selected.</h2><a class="text-link" href="/orders.html">View your orders</a></div>';
      return;
    }

    try {
      const result = await request(`/api/orders/${encodeURIComponent(id)}`);
      const order = result.order;
      confirmationContainer.innerHTML = `
        <nav class="checkout-steps" aria-label="Checkout progress"><span class="step-done">01 <b>Bag</b></span><i></i><span class="step-done">02 <b>Delivery</b></span><i></i><span class="step-active" aria-current="step">03 <b>Complete</b></span></nav>
        <section class="confirmation-head">
          <div class="success-icon" aria-hidden="true">✓</div>
          <p class="eyebrow">It’s on its way to being yours</p>
          <h1>Thank you for your order.</h1>
          <p>Order #${order.id} has been placed. We’ve saved the details below for you.</p>
        </section>
        <section class="confirmation-card">
          <div class="confirmation-meta">
            <div><span>Placed</span><strong>${new Date(`${order.createdAt.replace(' ', 'T')}Z`).toLocaleDateString()}</strong></div>
            <div><span>Status</span><strong class="status-pill">${escapeHtml(order.status)}</strong></div>
            <div><span>Delivering to</span><strong>${escapeHtml(order.customerName)}<br>${escapeHtml(order.address)}<br>${escapeHtml(order.phone)}</strong></div>
          </div>
          <div class="confirmation-items">
            ${order.items.map((item) => `<div class="confirmation-item"><img src="${escapeHtml(window.Store.imageFor(item))}" alt="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.priceCents * item.quantity)}</strong></div>`).join('')}
          </div>
          <div class="summary-line summary-total"><span>Total</span><strong>${money(order.totalCents)}</strong></div>
        </section>
        <a class="button button-dark" href="/orders.html">View all orders</a>
      `;
    } catch (error) {
      if (error.status === 401) {
        window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      confirmationContainer.innerHTML = `<div class="empty-state"><h2>We couldn't find that order.</h2><p>${escapeHtml(error.message)}</p><a class="text-link" href="/orders.html">View your orders</a></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    loadConfirmation();
  });
})();
