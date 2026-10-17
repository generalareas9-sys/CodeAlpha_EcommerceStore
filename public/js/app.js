(() => {
  const guestCartKey = 'small-hours-cart';
  const imageOverrides = {
    'Canvas Market Tote': 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=85',
  };
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

  function imageFor(product) {
    return imageOverrides[product.name] || product.imageUrl;
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
      const previousCount = Number(element.textContent) || 0;
      element.textContent = String(count);
      element.setAttribute('aria-label', `${count} items in your bag`);
      if (count > previousCount) {
        element.classList.remove('badge-bounce');
        void element.offsetWidth;
        element.classList.add('badge-bounce');
      }
    });
  }

  function renderShell() {
    const header = document.querySelector('#site-header');
    if (header) {
      header.innerHTML = `
        <div class="announcement">Thoughtfully chosen goods for everyday living</div>
        <header class="site-header">
          <div class="nav-inner wrap">
            <a class="brand" href="/" aria-label="Small Hours home">small<span>hours</span><i>.</i></a>
            <form class="header-search" id="header-search" role="search">
              <span class="search-icon" aria-hidden="true"></span>
              <label class="sr-only" for="header-search-input">Search products</label>
              <input id="header-search-input" type="search" placeholder="Search products, categories…" autocomplete="off">
            </form>
            <nav class="main-nav" aria-label="Main navigation">
              <a href="/#shop">Shop</a>
              <a class="account-link" href="/login.html">Log in</a>
              <a class="orders-link hidden" href="/orders.html">My orders</a>
              <button class="logout-link hidden" type="button">Log out</button>
              <a class="bag-link" href="/cart.html">
                <svg class="bag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
                <span>Bag</span><span class="bag-count" data-cart-count aria-label="0 items in your bag">0</span>
              </a>
            </nav>
            <a class="mobile-bag-link" href="/cart.html" aria-label="Shopping bag">
              <svg class="bag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
              <span class="bag-count" data-cart-count aria-label="0 items in your bag">0</span>
            </a>
            <button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false"><span></span><span></span><span></span></button>
          </div>
        </header>
      `;
    }

    const footer = document.querySelector('#site-footer');
    if (footer) {
      footer.innerHTML = `
        <footer class="site-footer">
          <div class="wrap footer-inner">
            <div class="footer-top">
              <div class="footer-brand">
                <a class="brand brand-light" href="/">small<span>hours</span><i>.</i></a>
                <p>Thoughtful things for everyday living.</p>
              </div>
              <div class="footer-column"><h2>Shop</h2><a href="/#shop">All products</a><a href="/#shop">Shop by category</a><a href="/cart.html">Your cart</a></div>
              <div class="footer-column"><h2>Your account</h2><a href="/login.html">Log in</a><a href="/register.html">Create an account</a><a href="/orders.html">My orders</a></div>
              <div class="footer-column"><h2>We’re here to help</h2><a href="mailto:hello@smallhours.store">hello@smallhours.store</a><span>Monday–Friday, 9am–5pm</span></div>
            </div>
            <div class="footer-bottom"><small>© ${new Date().getFullYear()} Small Hours. All rights reserved.</small><small>Thoughtfully made for the everyday.</small></div>
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

    const menuToggle = header?.querySelector('.menu-toggle');
    menuToggle?.addEventListener('click', () => {
      const siteHeader = header.querySelector('.site-header');
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      menuToggle.setAttribute('aria-label', expanded ? 'Open navigation menu' : 'Close navigation menu');
      siteHeader.classList.toggle('menu-open', !expanded);
    });

    header?.querySelector('#header-search')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = header.querySelector('#header-search-input').value.trim();
      if (!query) return;
      if (window.location.pathname === '/' && document.querySelector('#product-filters')) {
        const localSearch = document.querySelector('#product-search');
        localSearch.value = query;
        document.querySelector('#product-filters').requestSubmit();
        document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.href = `/?search=${encodeURIComponent(query)}#shop`;
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
    if (!guestItems.length) {
      await updateCartCount();
      return;
    }

    const accountCart = await request('/api/cart');
    const merged = new Map(accountCart.items.map((item) => [
      Number(item.id),
      { productId: Number(item.id), quantity: Number(item.quantity), stock: Number(item.stock) },
    ]));

    for (const item of guestItems) {
      const accountItem = merged.get(item.productId);
      let stock = accountItem ? accountItem.stock : 0;
      if (!accountItem) {
        try {
          const result = await request(`/api/products/${item.productId}`);
          stock = Number(result.product.stock);
        } catch (error) {
          if (error.status === 404) continue;
          throw error;
        }
      }
      merged.set(item.productId, {
        productId: item.productId,
        quantity: Math.min(stock, Math.max(item.quantity, accountItem?.quantity || 0)),
      });
    }

    const result = await request('/api/cart', {
      method: 'PUT',
      body: JSON.stringify({
        items: [...merged.values()].map(({ productId, quantity }) => ({ productId, quantity })),
      }),
    });
    localStorage.removeItem(guestCartKey);
    await updateCartCount(result.items);
    showToast('Your bag is up to date.');
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

  document.addEventListener('error', (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && !image.dataset.fallbackApplied) {
      image.dataset.fallbackApplied = 'true';
      image.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"%3E%3Crect width="640" height="640" fill="%23f0f2ef"/%3E%3Cpath d="M220 385h200l-20-155H240z" fill="%23dce3dd"/%3E%3Ccircle cx="320" cy="270" r="35" fill="%23cbd5cd"/%3E%3Ctext x="320" y="470" text-anchor="middle" fill="%23707873" font-family="Arial" font-size="24"%3ESmall Hours%3C/text%3E%3C/svg%3E';
    }
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key === guestCartKey) updateCartCount();
  });

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
    const loginNotice = sessionStorage.getItem('small-hours-login-notice');
    if (loginNotice) {
      sessionStorage.removeItem('small-hours-login-notice');
      showToast(loginNotice);
    }
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
    imageFor,
    escapeHtml,
    showToast,
    ready,
    get currentUser() { return currentUser; },
  };

  document.addEventListener('DOMContentLoaded', initialize);
})();
