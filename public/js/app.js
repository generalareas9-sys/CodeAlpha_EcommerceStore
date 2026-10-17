(() => {
  const guestCartKey = 'small-hours-cart';
  let currentUser = null;
  let toastTimer;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || 'Something went wrong. Please try again.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function readGuestCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(guestCartKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Saved guest cart could not be read.', error);
      return [];
    }
  }

  function writeGuestCart(items) {
    localStorage.setItem(guestCartKey, JSON.stringify(items));
  }

  function money(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function showToast(message, isError = false) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('toast-error', isError);
    toast.classList.add('toast-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('toast-visible'), 3200);
  }

  async function getCart() {
    if (currentUser) {
      const result = await request('/api/cart');
      return result.items;
    }

    const guestItems = readGuestCart();
    return Promise.all(guestItems.map(async (item) => {
      try {
        const result = await request(`/api/products/${encodeURIComponent(item.productId)}`);
        return { ...result.product, quantity: item.quantity };
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    })).then((items) => items.filter(Boolean));
  }

  async function saveCart(items) {
    if (currentUser) {
      const result = await request('/api/cart', {
        method: 'PUT',
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.id || item.productId, quantity: item.quantity })),
        }),
      });
      await updateCartCount(result.items);
      return result.items;
    }

    const cleanItems = items
      .filter((item) => item.quantity > 0)
      .map((item) => ({ productId: item.id || item.productId, quantity: item.quantity }));
    writeGuestCart(cleanItems);
    await updateCartCount(items);
    return items;
  }

  async function addToCart(product, quantity = 1) {
    const items = await getCart();
    const existing = items.find((item) => Number(item.id || item.productId) === product.id);
    const nextQuantity = (existing ? existing.quantity : 0) + quantity;

    if (nextQuantity > product.stock) {
      throw new Error(`Only ${product.stock} of this item are available.`);
    }

    if (existing) existing.quantity = nextQuantity;
    else items.push({ ...product, quantity });
    await saveCart(items);
    showToast(`${product.name} added to your bag.`);
  }

  async function updateCartCount(items) {
    let cartItems = items;
    if (!cartItems) {
      try {
        cartItems = currentUser
          ? (await request('/api/cart')).items
          : readGuestCart();
      } catch (error) {
        if (error.status !== 401) console.warn('Cart count could not be updated.', error);
        cartItems = readGuestCart();
      }
    }
    const count = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    document.querySelectorAll('[data-cart-count]').forEach((element) => {
      element.textContent = String(count);
      element.setAttribute('aria-label', `${count} items in your bag`);
    });
  }

  function renderShell() {
    const header = document.querySelector('#site-header');
    if (header) {
      header.innerHTML = `
        <div class="announcement">A good day starts with the little things.</div>
        <header class="site-header">
          <div class="nav-inner wrap">
            <a class="brand" href="/" aria-label="Small Hours home">small<span>hours</span><i>.</i></a>
            <nav class="main-nav" aria-label="Main navigation">
              <a href="/#shop">Shop</a>
              <a class="account-link" href="/login.html">Log in</a>
              <a class="orders-link hidden" href="/orders.html">My orders</a>
              <button class="logout-link hidden" type="button">Log out</button>
              <a class="bag-link" href="/cart.html">Bag <span class="bag-count" data-cart-count aria-label="0 items in your bag">0</span></a>
            </nav>
          </div>
        </header>
      `;
    }

    const footer = document.querySelector('#site-footer');
    if (footer) {
      footer.innerHTML = `
        <footer class="site-footer">
          <div class="wrap footer-inner">
            <a class="brand brand-light" href="/">small<span>hours</span><i>.</i></a>
            <p>Thoughtful things for everyday living.</p>
            <small>© ${new Date().getFullYear()} Small Hours. Made for the everyday.</small>
          </div>
        </footer>
      `;
    }

    header?.querySelector('.logout-link')?.addEventListener('click', async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        window.location.href = '/';
      } catch (error) {
        showToast(error.message, true);
      }
    });
  }

  async function syncGuestCart() {
    const savedItems = readGuestCart();
    const guestItems = savedItems
      .filter((item) => item && Number.isSafeInteger(Number(item.productId))
        && Number(item.productId) > 0 && Number.isSafeInteger(Number(item.quantity))
        && Number(item.quantity) > 0)
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Math.min(99, Number(item.quantity)),
      }));

    if (guestItems.length !== savedItems.length) {
      showToast('Some invalid saved bag items could not be synced.', true);
    }
    if (!guestItems.length) return;
    const result = await request('/api/cart/sync', {
      method: 'POST',
      body: JSON.stringify({ items: guestItems }),
    });
    localStorage.removeItem(guestCartKey);
    await updateCartCount(result.items);
  }

  function safeRedirect() {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (requested) {
      const destination = new URL(requested, window.location.origin);
      if (destination.origin === window.location.origin) {
        return `${destination.pathname}${destination.search}${destination.hash}`;
      }
    }
    return '/orders.html';
  }

  async function initialize() {
    renderShell();
    try {
      const result = await request('/api/auth/me');
      currentUser = result.user;
    } catch (error) {
      console.warn('Could not check login state.', error);
    }

    const accountLink = document.querySelector('.account-link');
    if (accountLink && currentUser) {
      accountLink.textContent = currentUser.name.split(' ')[0];
      accountLink.href = '/orders.html';
      document.querySelector('.orders-link')?.classList.remove('hidden');
      document.querySelector('.logout-link')?.classList.remove('hidden');
    }
    await updateCartCount();
    resolveReady();
    document.dispatchEvent(new CustomEvent('store:ready', { detail: { user: currentUser } }));
  }

  window.Store = {
    request,
    getCart,
    saveCart,
    addToCart,
    updateCartCount,
    readGuestCart,
    writeGuestCart,
    syncGuestCart,
    safeRedirect,
    money,
    escapeHtml,
    showToast,
    ready,
    get currentUser() { return currentUser; },
  };

  document.addEventListener('DOMContentLoaded', initialize);
})();
