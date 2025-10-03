const STORAGE_KEY = 'smart-wardrobe-items-v1';

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function generateId() {
  return 'itm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getPlaceholderImage(category, color) {
  const query = encodeURIComponent(`${color || ''} ${category || 'fashion'}`.trim());
  return `https://source.unsplash.com/600x400/?${query}`;
}

function renderWardrobe(items) {
  const grid = document.getElementById('wardrobeGrid');
  grid.innerHTML = '';

  if (!items.length) {
    grid.innerHTML = '<p class="empty">No items yet. Add your first piece above or load demo data.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <img src="${item.imageUrl || getPlaceholderImage(item.category, item.color)}" alt="${item.name}">
      <div class="row"><strong>${item.name}</strong><span class="tag">${item.category}</span></div>
      <div class="meta">${item.color} • ${item.formality} • ${item.warmth}</div>
      <div class="row">
        <small class="meta">Worn: ${item.wearCount || 0}</small>
        <div>
          <button class="btn" data-action="wore" data-id="${item.id}">I wore this</button>
          <button class="btn danger" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

function normalize(text) {
  return (text || '').toLowerCase();
}

function filterItems(allItems) {
  const term = normalize(document.getElementById('searchInput').value);
  const cat = document.getElementById('filterCategory').value;
  return allItems.filter(it => {
    const matchesTerm = !term || normalize(it.name).includes(term) || normalize(it.color).includes(term);
    const matchesCat = cat === 'all' || it.category === cat;
    return matchesTerm && matchesCat;
  });
}

function addItemFromForm(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const category = document.getElementById('category').value;
  const color = document.getElementById('color').value.trim();
  const formality = document.getElementById('formality').value;
  const warmth = document.getElementById('warmth').value;
  const imageUrl = document.getElementById('imageUrl').value.trim();
  const cost = parseFloat(document.getElementById('cost').value);
  const brand = document.getElementById('brand').value.trim();

  const items = loadItems();
  items.push({
    id: generateId(),
    name, category, color, formality, warmth,
    imageUrl: imageUrl || '',
    cost: isNaN(cost) ? null : Math.max(0, Math.round(cost)),
    brand: brand || null,
    wearCount: 0,
    lastWornAt: null,
    createdAt: Date.now()
  });
  saveItems(items);
  renderAll();
  e.target.reset();
}

function onWardrobeClick(e) {
  const action = e.target.getAttribute('data-action');
  if (!action) return;
  const id = e.target.getAttribute('data-id');
  const items = loadItems();
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return;
  if (action === 'delete') {
    items.splice(idx, 1);
  } else if (action === 'wore') {
    const now = Date.now();
    items[idx].wearCount = (items[idx].wearCount || 0) + 1;
    items[idx].lastWornAt = now;
  }
  saveItems(items);
  renderAll();
}

function suggestOutfit(e) {
  if (e) e.preventDefault();
  const tempC = parseFloat(document.getElementById('temp').value || '18');
  const occasion = document.getElementById('occasion').value;
  const items = loadItems();
  const pool = items.filter(it => matchOccasion(it, occasion) && matchWarmth(it, tempC));
  const outfit = buildOutfit(pool);
  renderOutfit(outfit);
}

function matchOccasion(item, occasion) {
  const levels = ['casual', 'smart-casual', 'business', 'formal'];
  return levels.indexOf(item.formality) >= levels.indexOf(occasion);
}

function matchWarmth(item, tempC) {
  if (tempC <= 8) return item.warmth !== 'light';
  if (tempC <= 18) return item.warmth !== 'warm';
  return item.warmth === 'light' || item.warmth === 'medium';
}

function pickOne(arr, predicate) {
  const options = predicate ? arr.filter(predicate) : arr.slice();
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function colorCompatible(a, b) {
  const nA = normalize(a);
  const nB = normalize(b);
  if (nA === nB) return true;
  const neutrals = ['white','black','gray','grey','navy','beige','tan','denim'];
  if (neutrals.includes(nA) || neutrals.includes(nB)) return true;
  return nA[0] !== nB[0];
}

function buildOutfit(pool) {
  const top = pickOne(pool, it => it.category === 'top' || it.category === 'dress');
  let bottom = null;
  if (!top || top.category !== 'dress') {
    bottom = pickOne(pool, it => it.category === 'bottom' && (!top || colorCompatible(top.color, it.color)));
  }
  const outer = pickOne(pool, it => it.category === 'outerwear');
  const shoes = pickOne(pool, it => it.category === 'shoes');
  const accessory = pickOne(pool, it => it.category === 'accessory');
  return { top, bottom, outer, shoes, accessory };
}

function itemCardHTML(item) {
  if (!item) return '';
  return `
    <div class="item-card">
      <img src="${item.imageUrl || getPlaceholderImage(item.category, item.color)}" alt="${item.name}">
      <div class="row"><strong>${item.name}</strong><span class="tag">${item.category}</span></div>
      <div class="meta">${item.color} • ${item.formality} • ${item.warmth}</div>
    </div>
  `;
}

function renderOutfit(outfit) {
  const target = document.getElementById('outfitResult');
  const hasAny = Object.values(outfit).some(Boolean);
  if (!hasAny) {
    target.innerHTML = '<p class="empty">Not enough items to suggest an outfit. Add more pieces.</p>';
    return;
  }
  target.innerHTML = [outfit.top, outfit.bottom, outfit.outer, outfit.shoes, outfit.accessory]
    .map(itemCardHTML)
    .join('');
}

function estimateResalePrice(item) {
  const base = item.cost != null ? item.cost : 40;
  const brandFactor = (() => {
    const name = normalize(item.brand || '');
    if (name.includes('gucci') || name.includes('prada') || name.includes('chanel')) return 0.6;
    if (name.includes('nike') || name.includes('adidas') || name.includes('zara') || name.includes('uniqlo')) return 0.4;
    return 0.35;
  })();
  const ageMonths = Math.max(0, Math.floor(((Date.now() - (item.createdAt || Date.now())) / (1000*60*60*24*30))));
  const ageFactor = Math.max(0.2, 1 - ageMonths * 0.02);
  const conditionFactor = Math.max(0.3, 1 - (item.wearCount || 0) * 0.05);
  const price = Math.round(base * brandFactor * ageFactor * conditionFactor);
  return Math.max(5, price);
}

function rarelyWorn(items) {
  const now = Date.now();
  const thresholdMs = 1000*60*60*24*45;
  return items.filter(it => (it.wearCount || 0) < 2 || !it.lastWornAt || (now - it.lastWornAt) > thresholdMs);
}

function renderResale(items) {
  const target = document.getElementById('resaleList');
  const candidates = rarelyWorn(items);
  if (!candidates.length) {
    target.innerHTML = '<p class="empty">No sell recommendations right now. Keep tracking wears!</p>';
    return;
  }
  target.innerHTML = candidates.map(it => {
    const price = estimateResalePrice(it);
    return `
      <div class="item-card">
        <img src="${it.imageUrl || getPlaceholderImage(it.category, it.color)}" alt="${it.name}">
        <div class="row"><strong>${it.name}</strong><span class="tag">$${price}</span></div>
        <div class="meta">${it.brand || 'Unknown brand'} • ${it.color} • ${it.category}</div>
        <div class="row">
          <small class="meta">Worn ${it.wearCount || 0} times</small>
          <button class="btn" data-action="mark-sold" data-id="${it.id}">Mark as sold</button>
        </div>
      </div>
    `;
  }).join('');
}

function onResaleClick(e) {
  if (e.target.getAttribute('data-action') !== 'mark-sold') return;
  const id = e.target.getAttribute('data-id');
  const items = loadItems();
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return;
  items.splice(idx, 1);
  saveItems(items);
  renderAll();
}

function seedDemo() {
  const demo = [
    { name: 'White Oxford Shirt', category: 'top', color: 'White', formality: 'smart-casual', warmth: 'light', brand: 'Uniqlo', cost: 35 },
    { name: 'Navy Chinos', category: 'bottom', color: 'Navy', formality: 'smart-casual', warmth: 'medium', brand: 'J.Crew', cost: 70 },
    { name: 'Black Blazer', category: 'outerwear', color: 'Black', formality: 'business', warmth: 'warm', brand: 'Zara', cost: 120 },
    { name: 'White Sneakers', category: 'shoes', color: 'White', formality: 'casual', warmth: 'light', brand: 'Nike', cost: 80 },
    { name: 'Brown Leather Belt', category: 'accessory', color: 'Brown', formality: 'smart-casual', warmth: 'light', brand: "Anderson's", cost: 60 },
    { name: 'Floral Dress', category: 'dress', color: 'Red', formality: 'smart-casual', warmth: 'light', brand: 'Reformation', cost: 180 }
  ].map(x => ({
    ...x,
    id: generateId(),
    imageUrl: '',
    wearCount: Math.floor(Math.random()*3),
    lastWornAt: Date.now() - Math.floor(Math.random()*100)*24*60*60*1000,
    createdAt: Date.now() - Math.floor(Math.random()*300)*24*60*60*1000
  }));
  saveItems(demo);
  renderAll();
}

function clearAll() {
  if (!confirm('Clear all wardrobe data?')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
}

function renderAll() {
  const items = filterItems(loadItems());
  renderWardrobe(items);
  renderResale(loadItems());
}

function init() {
  document.getElementById('add-item-form').addEventListener('submit', addItemFromForm);
  document.getElementById('wardrobeGrid').addEventListener('click', onWardrobeClick);
  document.getElementById('resaleList').addEventListener('click', onResaleClick);
  document.getElementById('seedBtn').addEventListener('click', seedDemo);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('searchInput').addEventListener('input', renderAll);
  document.getElementById('filterCategory').addEventListener('change', renderAll);
  document.getElementById('outfit-form').addEventListener('submit', suggestOutfit);
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);