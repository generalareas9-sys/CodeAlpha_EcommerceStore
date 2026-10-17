(() => {
  const { request, money, escapeHtml, addToCart, showToast } = window.Store;

  function productCard(product) {
    const article = document.createElement('article');
    article.className = 'product-card';
    article.innerHTML = `
      <a class="product-image" href="/product.html?id=${product.id}">
        <img src="${escapeHtml(window.Store.imageFor(product))}" alt="${escapeHtml(product.name)}" loading="lazy">
        <span class="product-category">${escapeHtml(product.category)}</span>
      </a>
      <div class="product-card-info">
        <div><h3><a href="/product.html?id=${product.id}">${escapeHtml(product.name)}</a></h3><p>${money(product.priceCents)}</p></div>
        <button class="add-button" type="button" aria-label="Add ${escapeHtml(product.name)} to bag" title="Add ${escapeHtml(product.name)} to bag" ${product.stock < 1 ? 'disabled' : ''}>${product.stock < 1 ? 'Out of stock' : 'Add to bag'}</button>
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
    const chips = document.querySelector('#category-chips');
    const initialQuery = new URLSearchParams(window.location.search);
    searchInput.value = initialQuery.get('search') || '';

    try {
      const categoryResult = await request('/api/products/categories');
      for (const category of categoryResult.categories) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.append(option);
      }
      if (initialQuery.has('category')) categorySelect.value = initialQuery.get('category');
      const allChip = document.createElement('button');
      allChip.className = `category-chip${categorySelect.value ? '' : ' active'}`;
      allChip.type = 'button';
      allChip.textContent = 'All';
      allChip.setAttribute('aria-pressed', String(!categorySelect.value));
      chips.append(allChip);

      const setActiveChip = (active) => {
        chips.querySelectorAll('.category-chip').forEach((chip) => {
          const selected = chip === active;
          chip.classList.toggle('active', selected);
          chip.setAttribute('aria-pressed', String(selected));
        });
      };

      allChip.addEventListener('click', () => {
        categorySelect.value = '';
        setActiveChip(allChip);
        loadProducts().catch((error) => showToast(error.message, true));
      });

      for (const category of categoryResult.categories) {
        const chip = document.createElement('button');
        chip.className = `category-chip${category === categorySelect.value ? ' active' : ''}`;
        chip.type = 'button';
        chip.textContent = category;
        chip.setAttribute('aria-pressed', String(category === categorySelect.value));
        chip.addEventListener('click', () => {
          categorySelect.value = category;
          setActiveChip(chip);
          loadProducts().catch((error) => showToast(error.message, true));
        });
        chips.append(chip);
      }

      async function loadProducts() {
        grid.innerHTML = Array.from({ length: 8 }, () => `
          <div class="skeleton-card" aria-hidden="true">
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
          </div>
        `).join('');
        const query = new URLSearchParams();
        if (searchInput.value.trim()) query.set('search', searchInput.value.trim());
        if (categorySelect.value) query.set('category', categorySelect.value);
        const result = await request(`/api/products?${query}`);
        grid.replaceChildren();

        if (!result.products.length) {
          grid.innerHTML = '<div class="empty-state"><h3>No matches this time.</h3><p>Try another search or choose a different category.</p></div>';
          countLabel.textContent = 'No matches this time.';
          return;
        }

        for (const product of result.products) grid.append(productCard(product));
        countLabel.textContent = `${result.products.length} ${result.products.length === 1 ? 'thoughtful find' : 'thoughtful finds'}`;
      }

      filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loadProducts().catch((error) => showToast(error.message, true));
      });
      categorySelect.addEventListener('change', () => {
        const chip = [...chips.querySelectorAll('.category-chip')].find((item) => item.textContent === (categorySelect.value || 'All'));
        if (chip) setActiveChip(chip);
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
              <div class="detail-image"><img src="${escapeHtml(window.Store.imageFor(product))}" alt="${escapeHtml(product.name)}"></div>
          <div class="detail-copy">
            <p class="eyebrow">${escapeHtml(product.category)}</p>
            <h1>${escapeHtml(product.name)}</h1>
            <p class="detail-price">${money(product.priceCents)}</p>
            <p class="detail-description">${escapeHtml(product.description)}</p>
                <p class="stock-note${product.stock > 0 ? '' : ' out-of-stock'}">${product.stock > 0 ? `${product.stock} in stock` : 'Currently out of stock'}</p>
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
