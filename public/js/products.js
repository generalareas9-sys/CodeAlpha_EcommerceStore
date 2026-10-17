(() => {
  const { request, money, escapeHtml, addToCart, showToast } = window.Store;

  function productCard(product) {
    const article = document.createElement('article');
    article.className = 'product-card';
    article.innerHTML = `
      <a class="product-image" href="/product.html?id=${product.id}">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">
        <span class="product-category">${escapeHtml(product.category)}</span>
      </a>
      <div class="product-card-info">
        <div><h3><a href="/product.html?id=${product.id}">${escapeHtml(product.name)}</a></h3><p>${money(product.priceCents)}</p></div>
        <button class="add-button" type="button" aria-label="Add ${escapeHtml(product.name)} to bag">+</button>
      </div>
    `;
    article.querySelector('.add-button').addEventListener('click', async () => {
      try {
        await addToCart(product);
      } catch (error) {
        showToast(error.message, true);
      }
    });
    return article;
  }

  async function loadListing() {
    await window.Store.ready;
    const grid = document.querySelector('#product-grid');
    const filterForm = document.querySelector('#product-filters');
    if (!grid || !filterForm) return;

    const categorySelect = document.querySelector('#category-filter');
    const searchInput = document.querySelector('#product-search');
    const countLabel = document.querySelector('#product-count');

    try {
      const categoryResult = await request('/api/products/categories');
      for (const category of categoryResult.categories) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.append(option);
      }

      async function loadProducts() {
        grid.innerHTML = '<p class="loading">Finding the good things…</p>';
        const query = new URLSearchParams();
        if (searchInput.value.trim()) query.set('search', searchInput.value.trim());
        if (categorySelect.value) query.set('category', categorySelect.value);
        const result = await request(`/api/products?${query}`);
        grid.replaceChildren();

        if (!result.products.length) {
          grid.innerHTML = '<div class="empty-state"><h3>Nothing here just yet.</h3><p>Try another search or category.</p></div>';
          countLabel.textContent = 'No matches this time.';
          return;
        }

        for (const product of result.products) grid.append(productCard(product));
        countLabel.textContent = `${result.products.length} good things to choose from.`;
      }

      filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loadProducts().catch((error) => showToast(error.message, true));
      });
      categorySelect.addEventListener('change', () => {
        loadProducts().catch((error) => showToast(error.message, true));
      });
      await loadProducts();
    } catch (error) {
      grid.innerHTML = `<div class="empty-state"><h3>We couldn't load the collection.</h3><p>${escapeHtml(error.message)}</p><p>Try again after the server is running and products have been seeded.</p></div>`;
    }
  }

  async function loadProductDetail() {
    await window.Store.ready;
    const container = document.querySelector('#product-detail');
    if (!container) return;

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      container.innerHTML = '<div class="empty-state"><h2>Choose a product from the collection.</h2><a class="text-link" href="/">Back to shop</a></div>';
      return;
    }

    try {
      const result = await request(`/api/products/${encodeURIComponent(id)}`);
      const product = result.product;
      document.title = `${product.name} — Small Hours`;
      document.querySelector('#breadcrumb-name').textContent = product.name;
      container.innerHTML = `
        <section class="product-detail">
          <div class="detail-image"><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}"></div>
          <div class="detail-copy">
            <p class="eyebrow">${escapeHtml(product.category)}</p>
            <h1>${escapeHtml(product.name)}</h1>
            <p class="detail-price">${money(product.priceCents)}</p>
            <p class="detail-description">${escapeHtml(product.description)}</p>
            <p class="stock-note">${product.stock > 0 ? `${product.stock} in stock` : 'Currently out of stock'}</p>
            <div class="buy-row">
              <label for="detail-quantity">Quantity</label>
              <input id="detail-quantity" type="number" min="1" max="${product.stock}" value="1" ${product.stock ? '' : 'disabled'}>
              <button class="button button-dark" id="detail-add" type="button" ${product.stock ? '' : 'disabled'}>Add to bag</button>
            </div>
            <a class="text-link" href="/">← Back to the collection</a>
          </div>
        </section>
      `;

      container.querySelector('#detail-add').addEventListener('click', async () => {
        const quantity = Number(container.querySelector('#detail-quantity').value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.stock) {
          showToast('Choose a quantity that is in stock.', true);
          return;
        }
        try {
          await addToCart(product, quantity);
        } catch (error) {
          showToast(error.message, true);
        }
      });
    } catch (error) {
      container.innerHTML = `<div class="empty-state"><h2>We couldn't find that item.</h2><p>${escapeHtml(error.message)}</p><a class="text-link" href="/">Back to the collection</a></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadListing();
    loadProductDetail();
  });
})();
