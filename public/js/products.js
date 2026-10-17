(() => {
  const { request, money, escapeHtml, addToCart, showToast } = window.Store;

  function ratingMarkup() {
    return '<span class="rating" aria-label="Rated 4.8 out of 5"><span aria-hidden="true">★★★★★</span><small>4.8</small></span>';
  }

  function productCard(product) {
    const article = document.createElement('article');
    article.className = 'product-card';
    const hasSalePrice = Number.isSafeInteger(product.originalPriceCents)
      && product.originalPriceCents > product.priceCents;
    const discount = hasSalePrice
      ? Math.round((1 - product.priceCents / product.originalPriceCents) * 100)
      : 0;
    const stockBadge = product.stock > 0 && product.stock <= 5
      ? '<span class="product-badge stock-badge">Low stock</span>'
      : hasSalePrice ? `<span class="product-badge sale-badge">-${discount}%</span>` : '';
    article.innerHTML = `
      <a class="product-image" href="/product.html?id=${product.id}">
        <img src="${escapeHtml(window.Store.imageFor(product))}" alt="${escapeHtml(product.name)}" loading="lazy">
        <span class="product-category">${escapeHtml(product.category)}</span>
        ${stockBadge}
      </a>
      <div class="product-card-info">
        <h3><a href="/product.html?id=${product.id}">${escapeHtml(product.name)}</a></h3>
        ${ratingMarkup()}
        <div class="price-row"><strong>${money(product.priceCents)}</strong>${hasSalePrice ? `<del>${money(product.originalPriceCents)}</del>` : ''}</div>
        <button class="button button-cta add-button" type="button" ${product.stock < 1 ? 'disabled' : ''}>${product.stock < 1 ? 'Out of stock' : 'Add to cart'}</button>
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
      const headerCategory = document.querySelector('#header-category');
      if (headerCategory && initialQuery.has('category')) headerCategory.value = initialQuery.get('category');
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
        if (!searchInput.value.trim() && !categorySelect.value) {
          renderHomeShelves(result.products);
        }
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
      if ((initialQuery.has('search') || initialQuery.has('category')) && document.querySelector('#best-seller-grid')) {
        request('/api/products')
          .then((allProducts) => renderHomeShelves(allProducts.products))
          .catch((error) => {
            document.querySelector('#best-seller-grid').innerHTML = `<p class="inline-error">${escapeHtml(error.message)}</p>`;
          });
      }
      await loadProducts();
    } catch (error) {
      grid.innerHTML = `<div class="empty-state"><h3>We couldn't load the collection.</h3><p>${escapeHtml(error.message)}</p><p>Try again after the server is running and products have been seeded.</p></div>`;
    }
  }

  function renderHomeShelves(products) {
    const bestSellers = document.querySelector('#best-seller-grid');
    if (!bestSellers) return;
    bestSellers.replaceChildren();
    for (const product of products.slice(0, 4)) bestSellers.append(productCard(product));
  }

  function initializeHomePromotions() {
    const slides = [...document.querySelectorAll('.hero-slide')];
    const dots = [...document.querySelectorAll('.hero-dot')];
    if (slides.length && dots.length) {
      let current = 0;
      const showSlide = (index) => {
        current = index;
        slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle('active', dotIndex === index);
          dot.setAttribute('aria-pressed', String(dotIndex === index));
        });
      };
      dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
      window.setInterval(() => showSlide((current + 1) % slides.length), 6000);
    }

    const clock = document.querySelector('#deal-clock');
    if (clock) {
      const updateClock = () => {
        const now = new Date();
        const seconds = 23 * 60 * 60 + 59 * 60 + 59
          - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
        const remaining = Math.max(0, seconds);
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const secs = remaining % 60;
        clock.textContent = [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
      };
      updateClock();
      window.setInterval(updateClock, 1000);
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
      document.title = `${product.name} — ShopNova`;
      document.querySelector('#breadcrumb-name').textContent = product.name;
      const hasSalePrice = Number.isSafeInteger(product.originalPriceCents)
        && product.originalPriceCents > product.priceCents;
      container.innerHTML = `
        <section class="product-detail">
          <div class="product-gallery">
            <div class="detail-image"><img class="gallery-main-image" src="${escapeHtml(window.Store.imageFor(product))}" alt="${escapeHtml(product.name)}"></div>
            <div class="gallery-thumbnails"><button type="button" class="gallery-thumb active" aria-label="Show product image 1"><img src="${escapeHtml(window.Store.imageFor(product))}" alt=""></button></div>
          </div>
          <div class="detail-copy">
            <p class="eyebrow">${escapeHtml(product.category)} <span class="detail-stock${product.stock > 0 ? '' : ' is-out'}">${product.stock > 0 ? 'In stock' : 'Out of stock'}</span></p>
            <h1>${escapeHtml(product.name)}</h1>
            ${ratingMarkup()}
            <p class="detail-price">${money(product.priceCents)}${hasSalePrice ? ` <del>${money(product.originalPriceCents)}</del>` : ''}</p>
            <p class="detail-description">${escapeHtml(product.description)}</p>
            <div class="buy-row">
              <label class="sr-only" for="detail-quantity">Quantity</label>
              <div class="quantity-control"><button type="button" data-quantity="decrease" aria-label="Decrease quantity">−</button><input id="detail-quantity" type="number" min="1" max="${product.stock}" value="1" ${product.stock ? '' : 'disabled'}><button type="button" data-quantity="increase" aria-label="Increase quantity">+</button></div>
            </div>
            <div class="detail-actions"><button class="button button-cta" id="detail-add" type="button" ${product.stock ? '' : 'disabled'}>Add to cart</button><button class="button button-outline" id="detail-buy" type="button" ${product.stock ? '' : 'disabled'}>Buy now</button></div>
            <div class="delivery-info"><p>🚚 <span><strong>Delivery</strong><small>Fast delivery on orders over $50</small></span></p><p>↩️ <span><strong>Easy returns</strong><small>Return within 30 days</small></span></p></div>
          </div>
        </section>
        <section class="product-extra">
          <div class="product-tabs" role="tablist" aria-label="Product information">
            <button type="button" class="product-tab active" role="tab" id="tab-description" aria-selected="true" aria-controls="panel-description">Description</button>
            <button type="button" class="product-tab" role="tab" id="tab-details" aria-selected="false" aria-controls="panel-details">Details</button>
            <button type="button" class="product-tab" role="tab" id="tab-reviews" aria-selected="false" aria-controls="panel-reviews">Reviews</button>
          </div>
          <div class="product-tab-panel" role="tabpanel" id="panel-description" aria-labelledby="tab-description">${escapeHtml(product.description)}</div>
          <div class="product-tab-panel hidden" role="tabpanel" id="panel-details" aria-labelledby="tab-details"><strong>Category:</strong> ${escapeHtml(product.category)} <span>·</span> <strong>Availability:</strong> ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</div>
          <div class="product-tab-panel hidden" role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews">Customer reviews will be available soon. ${ratingMarkup()}</div>
        </section>
        <section class="product-shelf related-products"><div class="section-heading"><div><p class="eyebrow">More to love</p><h2>Related products</h2></div><a class="text-link" href="/#featured">Shop all →</a></div><div class="product-grid shelf-grid" id="related-products-grid"><div class="skeleton-card"><div class="skeleton skeleton-image"></div><div class="skeleton skeleton-line"></div></div></div></section>
      `;

      const quantityInput = container.querySelector('#detail-quantity');
      container.querySelector('[data-quantity="decrease"]').addEventListener('click', () => {
        quantityInput.value = String(Math.max(1, Number(quantityInput.value) - 1));
      });
      container.querySelector('[data-quantity="increase"]').addEventListener('click', () => {
        quantityInput.value = String(Math.min(product.stock, Number(quantityInput.value) + 1));
      });
      container.querySelectorAll('.product-tab').forEach((tab) => tab.addEventListener('click', () => {
        container.querySelectorAll('.product-tab').forEach((item) => {
          item.classList.toggle('active', item === tab);
          item.setAttribute('aria-selected', String(item === tab));
        });
        container.querySelectorAll('.product-tab-panel').forEach((panel) => {
          panel.classList.toggle('hidden', panel.id !== tab.getAttribute('aria-controls'));
        });
      }));
      container.querySelector('.gallery-thumb').addEventListener('click', () => {
        container.querySelector('.gallery-main-image').src = window.Store.imageFor(product);
      });

      const addSelectedQuantity = async () => {
        const quantity = Number(quantityInput.value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.stock) {
          showToast('Choose a quantity that is in stock.', true);
          return false;
        }
        try {
          await addToCart(product, quantity);
          return true;
        } catch (error) {
          showToast(error.message, true);
          return false;
        }
      };
      container.querySelector('#detail-add').addEventListener('click', addSelectedQuantity);
      container.querySelector('#detail-buy').addEventListener('click', async () => {
        if (await addSelectedQuantity()) window.location.href = '/checkout.html';
      });

      try {
        const products = await request('/api/products');
        const related = products.products.filter((item) => item.id !== product.id).slice(0, 4);
        const relatedGrid = container.querySelector('#related-products-grid');
        relatedGrid.replaceChildren();
        related.forEach((item) => relatedGrid.append(productCard(item)));
      } catch (error) {
        container.querySelector('#related-products-grid').innerHTML = `<p class="inline-error">${escapeHtml(error.message)}</p>`;
      }
    } catch (error) {
      container.innerHTML = `<div class="empty-state"><h2>We couldn't find that item.</h2><p>${escapeHtml(error.message)}</p><a class="text-link" href="/">Back to the collection</a></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeHomePromotions();
    loadListing();
    loadProductDetail();
  });
})();
