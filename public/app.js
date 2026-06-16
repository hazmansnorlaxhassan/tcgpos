/* ==========================================================================
   AETHERIS CLIENT APPLICATION LOGIC
   ========================================================================== */

const API_BASE = window.location.origin;

// State Management
let state = {
  token: localStorage.getItem('tcg_token') || null,
  user: JSON.parse(localStorage.getItem('tcg_user')) || null,
  activeView: 'inventory-view',
  inventory: [],
  basket: [], // { card: Object, quantity: Number }
  salespersons: [],
  selectedStickerCard: null,
  html5QrScanner: null
};

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const profileUsername = document.getElementById('profile-username');
const profileRole = document.getElementById('profile-role');
const profileRoleIcon = document.getElementById('profile-role-icon');
const logoutBtn = document.getElementById('logout-btn');
const currentTimeEl = document.getElementById('current-time');
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebarEl = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// View switching and Nav
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.app-view');
const viewTitle = document.getElementById('view-title');

// Inventory Elements
const cardsContainer = document.getElementById('cards-container');
const inventorySearch = document.getElementById('inventory-search');
const btnToggleFilters = document.getElementById('btn-toggle-filters');
const filterDrawer = document.getElementById('filter-drawer');
const btnApplyFilters = document.getElementById('btn-apply-filters');
const btnClearFilters = document.getElementById('btn-clear-filters');
const btnAddCard = document.getElementById('btn-add-card');
const filterYear = document.getElementById('filter-year');
const filterRarity = document.getElementById('filter-rarity');
const filterLanguage = document.getElementById('filter-language');
const filterCondition = document.getElementById('filter-condition');

// Modal Elements
const cardModal = document.getElementById('card-modal');
const modalTitle = document.getElementById('modal-title');
const cardForm = document.getElementById('card-form');
const cardFormId = document.getElementById('card-form-id');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

// POS Elements
const btnToggleScanner = document.getElementById('btn-toggle-scanner');
const scannerStatus = document.getElementById('scanner-status');
const manualScanInput = document.getElementById('manual-scan-input');
const btnManualScan = document.getElementById('btn-manual-scan');
const posCardPreview = document.getElementById('pos-card-preview');
const basketItemsContainer = document.getElementById('basket-items');
const posSubtotalEl = document.getElementById('pos-subtotal');
const discountTypeSelect = document.getElementById('discount-type');
const discountValueInput = document.getElementById('discount-value');
const posTotalEl = document.getElementById('pos-total');
const paymentMethodSelect = document.getElementById('payment-method');
const btnCheckout = document.getElementById('btn-checkout');

// Scanned Card Preview DOM elements
const previewImage = document.getElementById('preview-image');
const previewName = document.getElementById('preview-name');
const previewYear = document.getElementById('preview-year');
const previewNumber = document.getElementById('preview-number');
const previewRarity = document.getElementById('preview-rarity');
const previewCondition = document.getElementById('preview-condition');
const previewLanguage = document.getElementById('preview-language');
const previewStock = document.getElementById('preview-stock');
const previewPrice = document.getElementById('preview-price');

// Reports Elements
const reportTotalRevenue = document.getElementById('report-total-revenue');
const reportTotalSold = document.getElementById('report-total-sold');
const reportSalesCount = document.getElementById('report-sales-count');
const salesHistoryTbody = document.getElementById('sales-history-tbody');

// Users (Salespersons) Elements
const registerSalespersonForm = document.getElementById('register-salesperson-form');
const salespersonsContainer = document.getElementById('salespersons-container');

// Sticker Elements
const stickerCardSelect = document.getElementById('sticker-card-select');
const stickerSizeSelect = document.getElementById('sticker-size');
const stickerQuantityInput = document.getElementById('sticker-quantity');
const btnPrintStickers = document.getElementById('btn-print-stickers');
const stickerSheetContainer = document.getElementById('sticker-sheet-container');

// Clock updater
setInterval(() => {
  const now = new Date();
  currentTimeEl.textContent = now.toLocaleTimeString();
}, 1000);


// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  if (state.token && state.user) {
    onLoginSuccess();
  } else {
    showLoginScreen();
  }
});

// Setup Listeners
function setupEventListeners() {
  // Login Form
  loginForm.addEventListener('submit', handleLogin);

  // Logout Button
  logoutBtn.addEventListener('click', handleLogout);

  // Mobile hamburger + overlay
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleMobileSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Navigation switching
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
      closeMobileSidebar(); // auto-close on mobile after nav
    });
  });

  // Inventory Filters
  btnToggleFilters.addEventListener('click', () => {
    filterDrawer.classList.toggle('hidden');
  });
  btnApplyFilters.addEventListener('click', () => {
    loadInventory();
  });
  btnClearFilters.addEventListener('click', () => {
    filterYear.value = '';
    filterRarity.value = '';
    filterLanguage.value = '';
    filterCondition.value = '';
    loadInventory();
  });
  inventorySearch.addEventListener('input', debounce(() => {
    loadInventory();
  }, 300));

  // Add Card
  btnAddCard.addEventListener('click', () => {
    openCardModal('add');
  });

  // Modal Buttons
  btnCloseModal.addEventListener('click', closeCardModal);
  btnCancelModal.addEventListener('click', closeCardModal);
  cardForm.addEventListener('submit', handleCardSubmit);

  // POS Scanner Controls
  btnToggleScanner.addEventListener('click', toggleQRScanner);
  btnManualScan.addEventListener('click', handleManualScan);
  manualScanInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualScan();
  });

  // POS Checkout Controls
  discountTypeSelect.addEventListener('change', () => {
    const type = discountTypeSelect.value;
    if (type === 'none') {
      discountValueInput.disabled = true;
      discountValueInput.value = 0;
    } else {
      discountValueInput.disabled = false;
    }
    updateBasketSummary();
  });


  discountValueInput.addEventListener('input', updateBasketSummary);
  paymentMethodSelect.addEventListener('input', updateBasketSummary);
  btnCheckout.addEventListener('click', handleCheckout);

  // Register Salesperson form
  registerSalespersonForm.addEventListener('submit', handleRegisterSalesperson);

  // Sticker Selector
  stickerCardSelect.addEventListener('change', () => {
    const cardId = stickerCardSelect.value;
    if (cardId) {
      state.selectedStickerCard = state.inventory.find(c => c.id == cardId);
      renderStickerPreview();
      btnPrintStickers.disabled = false;
    } else {
      state.selectedStickerCard = null;
      stickerSheetContainer.innerHTML = `
        <div class="sticker-placeholder-text">
          <i class="fa-solid fa-tags fa-3x mb-3 text-faded"></i>
          <p>Select a card from the left panel to render its sticker preview</p>
        </div>`;
      btnPrintStickers.disabled = true;
    }
  });

  // Sticker Controls update
  stickerSizeSelect.addEventListener('change', renderStickerPreview);
  stickerQuantityInput.addEventListener('input', renderStickerPreview);
  btnPrintStickers.addEventListener('click', () => {
    window.print();
  });
}

// ---------------------------------------------------------
// AUTHENTICATION AND LOGIN/LOGOUT
// ---------------------------------------------------------

async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('tcg_token', data.token);
    localStorage.setItem('tcg_user', JSON.stringify(data.user));

    onLoginSuccess();
  } catch (err) {
    loginError.classList.remove('hidden');
    loginError.querySelector('.error-msg').textContent = err.message;
  }
}

function handleLogout() {
  // Stop scanner if running
  stopQRScanner();

  state.token = null;
  state.user = null;
  localStorage.removeItem('tcg_token');
  localStorage.removeItem('tcg_user');
  showLoginScreen();
}

function showLoginScreen() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
  loginEmail.value = '';
  loginPassword.value = '';
  loginError.classList.add('hidden');
}

function onLoginSuccess() {
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');

  // Update profile sidebar display
  profileUsername.textContent = state.user.name;
  profileRole.textContent = state.user.role === 'admin' ? 'Administrator' : 'Salesperson';
  profileRoleIcon.className = state.user.role === 'admin' ? 'fa-solid fa-user-shield' : 'fa-solid fa-user-tie';

  // Manage visibility based on roles
  const adminOnlyEls = document.querySelectorAll('.admin-only');
  adminOnlyEls.forEach(el => {
    if (state.user.role === 'admin') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  // Switch to inventory by default
  switchView('inventory-view');
}

// ---------------------------------------------------------
// VIEW MANAGEMENT
// ---------------------------------------------------------

function switchView(viewId) {
  // Don't let salespeople view admin views
  if (state.user.role !== 'admin' && viewId === 'users-view') {
    return;
  }

  // Deactivate active scanner if leaving POS view
  if (state.activeView === 'pos-view' && viewId !== 'pos-view') {
    stopQRScanner();
  }

  state.activeView = viewId;

  // Toggle active class on sidebar
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle visibility of views
  views.forEach(v => {
    if (v.id === viewId) {
      v.classList.remove('hidden');
    } else {
      v.classList.add('hidden');
    }
  });

  // Set page headers
  let title = 'Inventory';
  if (viewId === 'pos-view') title = 'Point of Sales Scan';
  else if (viewId === 'reports-view') title = 'Sales History & Analytics';
  else if (viewId === 'users-view') title = 'Salespersons Access Control';
  else if (viewId === 'sticker-view') title = 'Card Labels & Stickers';

  viewTitle.textContent = title;

  // Load view-specific data
  if (viewId === 'inventory-view') {
    loadInventory();
  } else if (viewId === 'reports-view') {
    loadReports();
  } else if (viewId === 'users-view') {
    loadSalespersons();
  } else if (viewId === 'sticker-view') {
    loadStickersDropdown();
  }
}

// ---------------------------------------------------------
// INVENTORY CRUD
// ---------------------------------------------------------

async function loadInventory() {
  const search = inventorySearch.value.trim();
  const year = filterYear.value;
  const rarity = filterRarity.value;
  const language = filterLanguage.value;
  const condition = filterCondition.value;

  let url = `${API_BASE}/api/cards?`;
  const params = [];
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  if (year) params.push(`year=${year}`);
  if (rarity) params.push(`rarity=${encodeURIComponent(rarity)}`);
  if (language) params.push(`language=${encodeURIComponent(language)}`);
  if (condition) params.push(`condition=${encodeURIComponent(condition)}`);

  url += params.join('&');

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to load inventory.');

    const cards = await res.json();
    state.inventory = cards;
    renderInventory();
  } catch (err) {
    console.error(err);
  }
}

function renderInventory() {
  cardsContainer.innerHTML = '';

  if (state.inventory.length === 0) {
    cardsContainer.innerHTML = `
      <div class="empty-basket-message" style="grid-column: 1/-1; padding: 60px;">
        <i class="fa-solid fa-boxes-open fa-3x mb-3 text-faded"></i>
        <p>No cards matched your query.</p>
      </div>`;
    return;
  }

  state.inventory.forEach(card => {
    const cardPanel = document.createElement('div');
    cardPanel.className = 'card-panel glass-panel';

    const cardImg = card.image_url ? `${API_BASE}${card.image_url}` : 'https://placehold.co/250x350/161a23/ffffff?text=No+Image';

    cardPanel.innerHTML = `
      <div class="card-image-box">
        <img src="${cardImg}" alt="${card.name}">
        <span class="rarity-badge">${card.rarity}</span>
      </div>
      <div class="card-meta-main">
        <h4 class="card-title" title="${card.name}">${card.name}</h4>
        <span class="card-price text-gradient">$${parseFloat(card.price).toFixed(2)}</span>
      </div>
      <div class="card-spec-grid">
        <div class="card-spec-item">Year: <strong>${card.year_made}</strong></div>
        <div class="card-spec-item">No: <strong>${card.card_number}</strong></div>
        <div class="card-spec-item">Lang: <strong>${card.language}</strong></div>
        <div class="card-spec-item">Cond: <strong>${card.card_condition}</strong></div>
        <div class="card-spec-item" style="grid-column: 1 / -1">Stock Qty: <strong class="${card.quantity === 0 ? 'text-danger' : ''}">${card.quantity}</strong></div>
      </div>
      <div class="card-actions-row">
        ${state.user.role === 'admin' ? `
          <button class="btn btn-secondary-outline" onclick="openCardModal('edit', ${card.id})"><i class="fa-solid fa-edit"></i> Edit</button>
          <button class="btn btn-danger-outline" onclick="deleteCard(${card.id})"><i class="fa-solid fa-trash"></i>Delete</button>
        ` : ''}
        <button class="btn btn-primary" onclick="addCardToBasketDirectly(${card.id})" ${card.quantity === 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-shopping-basket"></i> ${card.quantity === 0 ? 'Out of Stock' : 'Sell'}
        </button>
      </div>
    `;

    cardsContainer.appendChild(cardPanel);
  });
}

function openCardModal(mode, cardId = null) {
  cardModal.classList.remove('hidden');
  cardForm.reset();

  if (mode === 'add') {
    modalTitle.textContent = 'Add New Trading Card';
    cardFormId.value = '';
  } else {
    modalTitle.textContent = 'Edit Trading Card';
    cardFormId.value = cardId;
    const card = state.inventory.find(c => c.id === cardId);

    if (card) {
      document.getElementById('card-name').value = card.name;
      document.getElementById('card-year').value = card.year_made;
      document.getElementById('card-number').value = card.card_number;
      document.getElementById('card-price').value = card.price;
      document.getElementById('card-rarity').value = card.rarity;
      document.getElementById('card-language').value = card.language;
      document.getElementById('card-condition').value = card.card_condition;
      document.getElementById('card-quantity').value = card.quantity;
    }
  }
}

function closeCardModal() {
  cardModal.classList.add('hidden');
}

async function handleCardSubmit(e) {
  e.preventDefault();
  const cardId = cardFormId.value;
  const isEdit = !!cardId;

  const formData = new FormData();
  formData.append('name', document.getElementById('card-name').value.trim());
  formData.append('year_made', document.getElementById('card-year').value);
  formData.append('card_number', document.getElementById('card-number').value.trim());
  formData.append('price', document.getElementById('card-price').value);
  formData.append('rarity', document.getElementById('card-rarity').value);
  formData.append('language', document.getElementById('card-language').value);
  formData.append('card_condition', document.getElementById('card-condition').value);
  formData.append('quantity', document.getElementById('card-quantity').value);

  const fileInput = document.getElementById('card-image');
  if (fileInput.files.length > 0) {
    formData.append('image', fileInput.files[0]);
  }

  const url = isEdit ? `${API_BASE}/api/cards/${cardId}` : `${API_BASE}/api/cards`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save card.');

    alert(data.message || 'Card saved successfully.');
    closeCardModal();
    loadInventory();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCard(cardId) {
  if (!confirm('Are you sure you want to delete this card from the inventory? This cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete card.');

    alert(data.message);
    loadInventory();
  } catch (err) {
    alert(err.message);
  }
}

function addCardToBasketDirectly(cardId) {
  // Load card details from internal state inventory
  const card = state.inventory.find(c => c.id === cardId);
  if (!card) return;

  addToBasket(card);
  switchView('pos-view');
}

// ---------------------------------------------------------
// POS SCANNER OPERATIONS
// ---------------------------------------------------------

function toggleQRScanner() {
  if (state.html5QrScanner) {
    stopQRScanner();
  } else {
    startQRScanner();
  }
}

function startQRScanner() {
  state.html5QrScanner = new Html5Qrcode("reader");

  btnToggleScanner.innerHTML = '<i class="fa-solid fa-camera-slash"></i> Stop Camera Scan';
  scannerStatus.textContent = 'Scanning...';
  scannerStatus.style.color = '#915032';

  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  state.html5QrScanner.start(
    { facingMode: "environment" },
    config,
    onQrScanSuccess,
    onQrScanError
  ).catch(err => {
    console.error(err);
    scannerStatus.textContent = 'Camera Error';
    btnToggleScanner.innerHTML = '<i class="fa-solid fa-camera"></i> Start Camera Scan';
    state.html5QrScanner = null;
    alert('Could not start webcam scanner. Ensure you have given permissions.');
  });
}

function stopQRScanner() {
  if (state.html5QrScanner) {
    state.html5QrScanner.stop().then(() => {
      state.html5QrScanner = null;
      btnToggleScanner.innerHTML = '<i class="fa-solid fa-camera"></i> Start Camera Scan';
      scannerStatus.textContent = 'Standby';
      scannerStatus.style.color = '';
    }).catch(err => {
      console.error('Error stopping QR scanner', err);
    });
  }
}

function onQrScanSuccess(decodedText, decodedResult) {
  // When a QR is scanned, the decodedText is the ID of the card
  console.log(`QR Scanned successfully: ${decodedText}`);

  // Play a brief beep alert or update status
  scannerStatus.textContent = 'Scanned!';
  setTimeout(() => {
    if (state.html5QrScanner) scannerStatus.textContent = 'Scanning...';
  }, 1000);

  lookupAndProcessCardId(decodedText);
}

function onQrScanError(err) {
  // Ignore scan match fail logs to avoid console bloat
}

function handleManualScan() {
  const cardIdStr = manualScanInput.value.trim();
  if (!cardIdStr) return;
  lookupAndProcessCardId(cardIdStr);
  manualScanInput.value = '';
}

async function lookupAndProcessCardId(cardId) {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) {
      throw new Error('Card not found in database.');
    }

    const card = await res.json();
    displayCardPreview(card);
    addToBasket(card);
  } catch (err) {
    alert(err.message);
  }
}

function displayCardPreview(card) {
  posCardPreview.classList.remove('hidden');

  previewImage.src = card.image_url ? `${API_BASE}${card.image_url}` : 'https://placehold.co/250x350/161a23/ffffff?text=No+Image';
  previewName.textContent = card.name;
  previewYear.textContent = card.year_made;
  previewNumber.textContent = card.card_number;
  previewRarity.textContent = card.rarity;
  previewCondition.textContent = card.card_condition;
  previewLanguage.textContent = card.language;
  previewStock.textContent = card.quantity;
  previewPrice.textContent = `$${parseFloat(card.price).toFixed(2)}`;
}

// ---------------------------------------------------------
// POS REGISTER / BASKET
// ---------------------------------------------------------

function addToBasket(card) {
  // Check if stock is 0
  if (card.quantity <= 0) {
    alert('This card is out of stock!');
    return;
  }

  const existingItem = state.basket.find(item => item.card.id === card.id);
  if (existingItem) {
    if (existingItem.quantity < card.quantity) {
      existingItem.quantity += 1;
    } else {
      alert(`Cannot add more. Limited to stock capacity (${card.quantity}).`);
    }
  } else {
    state.basket.push({ card, quantity: 1 });
  }

  renderBasket();
}

function removeFromBasket(cardId) {
  state.basket = state.basket.filter(item => item.card.id !== cardId);
  renderBasket();
}

function updateBasketQty(cardId, delta) {
  const item = state.basket.find(item => item.card.id === cardId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromBasket(cardId);
  } else if (newQty <= item.card.quantity) {
    item.quantity = newQty;
    renderBasket();
  } else {
    alert(`Cannot add more. Stock limit is ${item.card.quantity}.`);
  }
}

function renderBasket() {
  basketItemsContainer.innerHTML = '';

  if (state.basket.length === 0) {
    basketItemsContainer.innerHTML = `
      <div class="empty-basket-message">
        <i class="fa-solid fa-qrcode fa-3x mb-3 text-faded"></i>
        <p>Scan a QR code to register a card for sale</p>
      </div>`;
    btnCheckout.disabled = true;
    updateBasketSummary();
    return;
  }

  state.basket.forEach(item => {
    const basketItem = document.createElement('div');
    basketItem.className = 'basket-item';

    basketItem.innerHTML = `
      <div class="basket-item-info">
        <span class="basket-item-title">${item.card.name}</span>
        <span class="basket-item-spec">${item.card.card_number} • ${item.card.card_condition} • ${item.card.language}</span>
        <div class="basket-item-qty">
          <button class="qty-btn" onclick="updateBasketQty(${item.card.id}, -1)"><i class="fa-solid fa-minus"></i></button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="updateBasketQty(${item.card.id}, 1)"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
      <div class="basket-item-price">
        <span>$${(parseFloat(item.card.price) * item.quantity).toFixed(2)}</span>
        <button onclick="removeFromBasket(${item.card.id})"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;

    basketItemsContainer.appendChild(basketItem);
  });

  btnCheckout.disabled = false;
  updateBasketSummary();
}

function updateBasketSummary() {
  let subtotal = 0;
  state.basket.forEach(item => {
    subtotal += parseFloat(item.card.price) * item.quantity;
  });

  posSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;

  const discountType = discountTypeSelect.value;

  const discountVal = parseFloat(discountValueInput.value) || 0;
  let totalDiscount = 0;

  if (discountType === 'percentage') {
    totalDiscount = subtotal * (discountVal / 100);
  } else if (discountType === 'fixed') {
    totalDiscount = discountVal;
  }

  const finalTotal = Math.max(0, subtotal - totalDiscount);
  posTotalEl.textContent = `$${finalTotal.toFixed(2)}`;
}

async function handleCheckout() {
  if (state.basket.length === 0) return;

  const discountType = discountTypeSelect.value;

  const discountVal = parseFloat(discountValueInput.value) || 0;

  const paymentMethod = paymentMethodSelect.value;

  btnCheckout.disabled = true;
  btnCheckout.textContent = 'Recording Sale...';

  try {
    // Process each checkout item in sequence or parallel.
    // The discount is applied globally, so we will distribute the discount proportionally among items,
    // or apply it fully to the single transaction API if the backend allowed a full transaction cart checkout.
    // Since our backend POST /api/sales registers a single card ID sale, we can map/apply the discount on each item or send them.
    // Wait, let's distribute the discount proportionally to match the totals!
    // Example: total subtotal = S. Item subtotal = s. Discount value = D.
    // Distributed discount = D * (s / S).
    let subtotal = 0;
    state.basket.forEach(item => {
      subtotal += parseFloat(item.card.price) * item.quantity;
    });

    for (let i = 0; i < state.basket.length; i++) {
      const item = state.basket[i];
      const itemSubtotal = parseFloat(item.card.price) * item.quantity;

      let distributedVal = 0;
      let distributedType = 'none';

      if (discountType === 'percentage') {
        distributedType = 'percentage';
        distributedVal = discountVal; // Percent remains constant for each item
      } else if (discountType === 'fixed') {
        distributedType = 'fixed';
        distributedVal = (itemSubtotal / subtotal) * discountVal;
      }





      const res = await fetch(`${API_BASE}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({
          card_id: item.card.id,
          quantity: item.quantity,
          discount_type: distributedType,
          discount_value: distributedVal,
          payment_method: paymentMethod,

        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record checkout item.');
    }

    alert('Checkout successful! Sale recorded.');

    // Clear Basket
    state.basket = [];
    renderBasket();

    // Clear Preview
    posCardPreview.classList.add('hidden');
    discountTypeSelect.value = 'none';
    discountValueInput.value = 0;
    discountValueInput.disabled = true;
    updateBasketSummary();

  } catch (err) {
    alert(err.message);
  } finally {
    btnCheckout.textContent = 'Record Sale';
    btnCheckout.disabled = false;
  }
}

// ---------------------------------------------------------
// SALES HISTORY & LOGS
// ---------------------------------------------------------

async function loadReports() {
  try {
    const res = await fetch(`${API_BASE}/api/sales/report`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to fetch reports.');

    const data = await res.json();

    // Set statistics
    reportTotalRevenue.textContent = `$${parseFloat(data.summary.totalRevenue).toFixed(2)}`;
    reportTotalSold.textContent = data.summary.totalItemsSold;
    reportSalesCount.textContent = data.summary.salesCount;

    // Populate log table
    salesHistoryTbody.innerHTML = '';

    if (data.sales.length === 0) {
      salesHistoryTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No transaction logs available.</td></tr>';
      return;
    }

    data.sales.forEach(sale => {
      const tr = document.createElement('tr');

      const date = new Date(sale.sale_timestamp).toLocaleString();
      const discText = sale.discount_type === 'none' ? '-' :
        sale.discount_type === 'percentage' ? `${sale.discount_value}%` :
          `$${parseFloat(sale.discount_value).toFixed(2)}`;

      tr.innerHTML = `
        <td>#${sale.sale_id}</td>
        <td><strong>${sale.card_name}</strong> <span class="text-faded">${sale.card_number}</span></td>
        <td>${sale.quantity}</td>
        <td>$${parseFloat(sale.base_price).toFixed(2)}</td>
        <td>${discText}</td>
        <td class="text-gradient" style="font-weight:700;">$${parseFloat(sale.total_price).toFixed(2)}</td>
        <td>${sale.payment_method}</td>
        <td>${sale.salesperson_name}</td>
        <td>${date}</td>
      `;

      salesHistoryTbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------
// SALESPERSONS / USERS ACCESS CONTROL (ADMIN ONLY)
// ---------------------------------------------------------

async function loadSalespersons() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/salespersons`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to load salespeople.');

    const salespersons = await res.json();
    state.salespersons = salespersons;
    renderSalespersons();
  } catch (err) {
    console.error(err);
  }
}

function renderSalespersons() {
  salespersonsContainer.innerHTML = '';

  if (state.salespersons.length === 0) {
    salespersonsContainer.innerHTML = '<div class="text-faded p-3">No salespersons registered yet.</div>';
    return;
  }

  state.salespersons.forEach(sp => {
    const userCard = document.createElement('div');
    userCard.className = 'salesperson-user-card';

    userCard.innerHTML = `
      <div class="salesperson-user-info">
        <span class="salesperson-user-name">${sp.name}</span>
        <span class="salesperson-user-email">${sp.email}</span>
      </div>
      <button class="btn btn-danger-outline" onclick="deleteSalesperson(${sp.id})">
        <i class="fa-solid fa-user-minus"></i> Remove
      </button>
    `;

    salespersonsContainer.appendChild(userCard);
  });
}

async function handleRegisterSalesperson(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/register-salesperson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register.');

    alert('Salesperson registered successfully!');
    registerSalespersonForm.reset();
    loadSalespersons();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSalesperson(id) {
  if (!confirm('Are you sure you want to remove this salesperson? They will lose access to the system.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove user.');

    alert(data.message);
    loadSalespersons();
  } catch (err) {
    alert(err.message);
  }
}

// ---------------------------------------------------------
// PHYSICAL STICKER TEMPLATES & LABELS
// ---------------------------------------------------------

async function loadStickersDropdown() {
  try {
    const res = await fetch(`${API_BASE}/api/cards`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error();

    const cards = await res.json();
    state.inventory = cards;

    // Populate dropdown
    stickerCardSelect.innerHTML = '<option value="">-- Select a Card --</option>';
    cards.forEach(card => {
      const option = document.createElement('option');
      option.value = card.id;
      option.textContent = `${card.name} (${card.card_number})`;
      stickerCardSelect.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

function renderStickerPreview() {
  const card = state.selectedStickerCard;
  if (!card) return;

  const size = stickerSizeSelect.value;
  const copies = parseInt(stickerQuantityInput.value) || 1;

  stickerSheetContainer.innerHTML = '';

  // Generate the specified quantity of sticker templates
  for (let i = 0; i < copies; i++) {
    const stickerDiv = document.createElement('div');
    stickerDiv.className = `physical-sticker sticker-${size}`;

    // Compute details to fit
    const nameText = card.name.length > 28 ? card.name.substring(0, 26) + '..' : card.name;
    const condText = card.card_condition.split(' ')[0]; // Near Mint -> Near
    const yearText = card.year_made;
    const rarityText = card.rarity.length > 12 ? card.rarity.substring(0, 10) + '..' : card.rarity;

    stickerDiv.innerHTML = `
      <div class="sticker-info">
        <div class="sticker-title">${nameText}</div>
        <div class="sticker-spec">No: ${card.card_number}</div>
        <div class="sticker-spec">Year: ${yearText} • Cond: ${condText}</div>
        <div class="sticker-spec">Rarity: ${rarityText}</div>
        <div class="sticker-price">$${parseFloat(card.price).toFixed(2)}</div>
      </div>
      <div class="sticker-qr">
        <img src="${API_BASE}/api/cards/${card.id}/qr" alt="QR">
      </div>
    `;

    stickerSheetContainer.appendChild(stickerDiv);
  }
}

// ---------------------------------------------------------
// MOBILE SIDEBAR HELPERS
// ---------------------------------------------------------

function toggleMobileSidebar() {
  const isOpen = sidebarEl.classList.contains('mobile-open');
  if (isOpen) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

function openMobileSidebar() {
  sidebarEl.classList.add('mobile-open');
  sidebarOverlay.classList.add('visible');
  hamburgerBtn.classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeMobileSidebar() {
  sidebarEl.classList.remove('mobile-open');
  sidebarOverlay.classList.remove('visible');
  hamburgerBtn.classList.remove('open');
  document.body.style.overflow = '';
}

// ---------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
