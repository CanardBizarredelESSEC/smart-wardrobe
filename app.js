(function () {
	'use strict';

	const STORAGE_KEY = 'smart-wardrobe-items-v2';

	const $ = (id) => document.getElementById(id);
	const qs = (sel, el = document) => el.querySelector(sel);

	function loadItems() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const arr = raw ? JSON.parse(raw) : [];
			return Array.isArray(arr) ? arr : [];
		} catch { return []; }
	}
	function saveItems(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
	function uid() { return 'itm_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
	function norm(s) { return (s || '').toLowerCase(); }
	function imgFor(cat, color) {
		return `https://source.unsplash.com/800x1000/?${encodeURIComponent(`${color || ''} ${cat||'fashion'}`.trim())}`;
	}

	/* Tabs */
	function activateTab(tabId) {
		document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
		$('#' + tabId).classList.add('active');
		document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
	}

	/* Outfit Engine (deck) */
	let deck = [];
	function generateOutfitPool(tempC, occasion, items) {
		const fitOccasion = it => {
			const lvl = ['casual','smart-casual','business','formal'];
			return lvl.indexOf(it.formality) >= lvl.indexOf(occasion);
		};
		const fitWarmth = it => {
			if (tempC <= 8) return it.warmth !== 'light';
			if (tempC <= 18) return it.warmth !== 'warm';
			return it.warmth !== 'warm';
		};
		return items.filter(it => fitOccasion(it) && fitWarmth(it));
	}
	function buildOutfit(pool) {
		const pick = (p) => {
			const opts = pool.filter(p);
			return opts.length ? opts[Math.floor(Math.random()*opts.length)] : null;
		};
		const topOrDress = pick(it => it.category === 'top' || it.category === 'dress');
		let bottom = null;
		if (!topOrDress || topOrDress.category !== 'dress') {
			bottom = pick(it => it.category === 'bottom');
		}
		const outer = pick(it => it.category === 'outerwear');
		const shoes = pick(it => it.category === 'shoes');
		const accessory = pick(it => it.category === 'accessory');
		return { top: topOrDress, bottom, outer, shoes, accessory };
	}
	function buildDeck() {
		const temp = Number($('#temp').value || 18);
		const occ = $('#occasion').value || 'smart-casual';
		const items = loadItems();
		const pool = generateOutfitPool(temp, occ, items);
		const out = [];
		const want = 10;
		for (let i=0;i<want;i++){
			const o = buildOutfit(pool);
			if (Object.values(o).some(Boolean)) out.push(o);
		}
		deck = out;
		renderDeck();
	}

	function outfitImages(outfit) {
		const imgs = [];
		if (outfit.top) imgs.push(outfit.top.imageUrl || imgFor(outfit.top.category, outfit.top.color));
		if (outfit.bottom) imgs.push(outfit.bottom.imageUrl || imgFor(outfit.bottom.category, outfit.bottom.color));
		if (outfit.dress) imgs.push(outfit.dress.imageUrl || imgFor('dress', ''));
		if (outfit.outer) imgs.push(outfit.outer.imageUrl || imgFor(outfit.outer.category, outfit.outer.color));
		if (outfit.shoes) imgs.push(outfit.shoes.imageUrl || imgFor(outfit.shoes.category, outfit.shoes.color));
		return imgs.length ? imgs : [imgFor('fashion','outfit')];
	}

	function outfitTitle(outfit) {
		const names = [];
		if (outfit.top) names.push(outfit.top.name);
		if (outfit.bottom) names.push(outfit.bottom.name);
		if (outfit.outer) names.push(outfit.outer.name);
		if (outfit.shoes) names.push(outfit.shoes.name);
		if (!names.length && outfit.dress) names.push(outfit.dress.name);
		return names.join(' + ');
	}

	function renderDeck() {
		const deckEl = $('#deck');
		deckEl.innerHTML = '';
		if (!deck.length) {
			deckEl.innerHTML = '<p class="empty">No outfits to show. Add items or adjust filters, then Refresh.</p>';
			return;
		}
		deck.slice().reverse().forEach((outfit, idx) => {
			const card = document.createElement('article');
			card.className = 'card';
			card.dataset.index = String(idx);
			const imgs = outfitImages(outfit);
			card.innerHTML = `
				<div class="stamp like">LIKE</div>
				<div class="stamp nope">NOPE</div>
				<img class="card__img" src="${imgs[0]}" alt="Outfit">
				<div class="card__body">
					<div class="card__row">
						<strong>${escape(outfitTitle(outfit) || 'Suggested Outfit')}</strong>
						<span class="badge">${summaryBadge(outfit)}</span>
					</div>
					<div class="meta">${metaLine(outfit)}</div>
				</div>
			`;
			enableSwipe(card, () => onLike(outfit, card), () => onNope(card));
			deckEl.appendChild(card);
		});
	}

	function summaryBadge(o) {
		const cats = ['top','dress','bottom','outer','shoes','accessory'].filter(k => o[k]).length;
		return `${cats} pcs`;
	}
	function metaLine(o) {
		const bits = [];
		if (o.top) bits.push(`${o.top.color} ${o.top.category}`);
		if (o.bottom) bits.push(`${o.bottom.color} ${o.bottom.category}`);
		if (o.outer) bits.push(`${o.outer.color} outer`);
		if (o.shoes) bits.push(`${o.shoes.color} shoes`);
		return bits.join(' • ');
	}
	function escape(s) {
		return String(s||'').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
	}

	/* Swipe gestures */
	function enableSwipe(card, onLike, onNope) {
		let startX = 0, startY = 0, currentX = 0, currentY = 0, dragging = false;

		const likeStamp = qs('.stamp.like', card);
		const nopeStamp = qs('.stamp.nope', card);

		function onStart(e) {
			dragging = true;
			const t = e.touches ? e.touches[0] : e;
			startX = t.clientX; startY = t.clientY;
			card.style.transition = 'none';
		}
		function onMove(e) {
			if (!dragging) return;
			const t = e.touches ? e.touches[0] : e;
			currentX = t.clientX - startX;
			currentY = t.clientY - startY;
			const rot = currentX / 20;
			card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rot}deg)`;
			const likeOpacity = Math.min(1, Math.max(0, currentX / 120));
			const nopeOpacity = Math.min(1, Math.max(0, -currentX / 120));
			likeStamp.style.opacity = likeOpacity;
			nopeStamp.style.opacity = nopeOpacity;
		}
		function onEnd() {
			if (!dragging) return;
			dragging = false;
			card.style.transition = 'transform .25s ease';
			if (currentX > 120) {
				card.style.transform = 'translate(500px, -40px) rotate(20deg)';
				setTimeout(onLike, 180);
			} else if (currentX < -120) {
				card.style.transform = 'translate(-500px, -40px) rotate(-20deg)';
				setTimeout(onNope, 180);
			} else {
				card.style.transform = '';
				likeStamp.style.opacity = 0;
				nopeStamp.style.opacity = 0;
			}
			currentX = 0; currentY = 0;
		}

		card.addEventListener('touchstart', onStart, {passive:true});
		card.addEventListener('touchmove', onMove, {passive:true});
		card.addEventListener('touchend', onEnd);
		card.addEventListener('mousedown', onStart);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onEnd);
	}

	function onLike(outfit, cardEl) {
		// Mark items as worn
		const items = loadItems();
		['top','bottom','outer','shoes','dress','accessory'].forEach(k => {
			const it = outfit[k];
			if (!it) return;
			const idx = items.findIndex(x => x.id === it.id);
			if (idx !== -1) {
				items[idx].wearCount = (items[idx].wearCount || 0) + 1;
				items[idx].lastWornAt = Date.now();
			}
		});
		saveItems(items);
		removeTopCard(cardEl);
	}

	function onNope(cardEl) {
		removeTopCard(cardEl);
	}

	function removeTopCard(cardEl) {
		cardEl.remove();
		deck.shift();
	}

	/* Wardrobe */
	function renderWardrobe() {
		const q = norm($('#searchInput').value || '');
		const cat = $('#filterCategory').value || 'all';
		const grid = $('#wardrobeGrid');
		const items = loadItems().filter(it => {
			const t = !q || norm(it.name).includes(q) || norm(it.color).includes(q);
			const c = cat === 'all' || it.category === cat;
			return t && c;
		});
		grid.innerHTML = items.length ? '' : '<p class="empty">No items yet.</p>';
		for (const it of items) {
			const el = document.createElement('div');
			el.className = 'item';
			el.innerHTML = `
				<img src="${it.imageUrl || imgFor(it.category, it.color)}" alt="${escape(it.name)}">
				<div class="pad">
					<div class="row">
						<strong>${escape(it.name)}</strong>
						<span class="badge">${escape(it.category)}</span>
					</div>
					<div class="muted">${escape(it.color)} • ${escape(it.formality)} • ${escape(it.warmth)}</div>
					<div class="row" style="margin-top:6px;">
						<small class="muted">Worn ${it.wearCount||0}</small>
						<div>
							<button class="btn btn-secondary" data-act="wore" data-id="${it.id}">Wore</button>
							<button class="btn btn-danger" data-act="del" data-id="${it.id}">Delete</button>
						</div>
					</div>
				</div>
			`;
			grid.appendChild(el);
		}
	}

	document.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-act]');
		if (!btn) return;
		const act = btn.dataset.act;
		const id = btn.dataset.id;
		const items = loadItems();
		const idx = items.findIndex(x => x.id === id);
		if (idx === -1) return;
		if (act === 'del') items.splice(idx,1);
		if (act === 'wore') {
			items[idx].wearCount = (items[idx].wearCount||0)+1;
			items[idx].lastWornAt = Date.now();
		}
		saveItems(items);
		renderWardrobe();
	});

	/* Sell */
	function estimateResalePrice(item) {
		const base = item.cost != null ? item.cost : 40;
		const brand = norm(item.brand || '');
		const brandFactor = /gucci|prada|chanel|dior|hermes|louis/.test(brand) ? 0.6
			: /nike|adidas|uniqlo|zara|h&m|cos/.test(brand) ? 0.4 : 0.35;
		const ageMonths = Math.max(0, Math.floor((Date.now() - (item.createdAt || Date.now())) / (1000*60*60*24*30)));
		const ageFactor = Math.max(0.2, 1 - ageMonths * 0.02);
		const conditionFactor = Math.max(0.3, 1 - (item.wearCount || 0) * 0.05);
		return Math.max(5, Math.round(base * brandFactor * ageFactor * conditionFactor));
	}
	function rarelyWorn(items) {
		const now = Date.now();
		const inactive = 1000*60*60*24*45;
		return items.filter(it => (it.wearCount || 0) < 2 || !it.lastWornAt || (now - it.lastWornAt) > inactive);
	}
	function renderSell() {
		const items = loadItems();
		const list = $('#resaleList');
		const cand = rarelyWorn(items);
		if (!cand.length) { list.innerHTML = '<p class="empty">Nothing to sell right now.</p>'; return; }
		list.innerHTML = '';
		for (const it of cand) {
			const price = estimateResalePrice(it);
			const row = document.createElement('div');
			row.className = 'sell-card';
			row.innerHTML = `
				<img src="${it.imageUrl || imgFor(it.category, it.color)}" alt="${escape(it.name)}">
				<div>
					<div style="display:flex; justify-content:space-between; align-items:center;">
						<strong>${escape(it.name)}</strong>
						<span class="badge">$${price}</span>
					</div>
					<div class="meta">${escape(it.brand || 'Brand N/A')} • ${escape(it.color)} • ${escape(it.category)}</div>
					<div style="margin-top:6px; display:flex; gap:8px;">
						<button class="btn btn-secondary" data-act="mark-sold" data-id="${it.id}">Mark sold</button>
						<button class="btn btn-ghost" data-act="wore" data-id="${it.id}">Keep</button>
					</div>
				</div>
			`;
			list.appendChild(row);
		}
	}
	document.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-act="mark-sold"]');
		if (!btn) return;
		const id = btn.dataset.id;
		const items = loadItems();
		const idx = items.findIndex(x => x.id === id);
		if (idx !== -1) {
			items.splice(idx,1);
			saveItems(items);
			renderSell();
			renderWardrobe();
		}
	});

	/* Bottom Sheet (Add) */
	function openSheet() { $('#sheet').setAttribute('aria-hidden','false'); }
	function closeSheet() { $('#sheet').setAttribute('aria-hidden','true'); }
	function submitAdd(e) {
		e.preventDefault();
		const name = $('#name').value.trim();
		const category = $('#category').value;
		const color = $('#color').value.trim();
		const formality = $('#formality').value;
		const warmth = $('#warmth').value;
		const imageUrl = $('#imageUrl').value.trim();
		const cost = $('#cost').value ? Math.max(0, Math.round(Number($('#cost').value))) : null;
		const brand = $('#brand').value.trim() || null;
		if (!name || !category || !color) return;

		const items = loadItems();
		items.push({
			id: uid(), name, category, color, formality, warmth,
			imageUrl: imageUrl || '', cost, brand,
			wearCount: 0, lastWornAt: null, createdAt: Date.now()
		});
		saveItems(items);
		closeSheet();
		$('#addForm').reset();
		renderWardrobe();
		buildDeck();
	}

	/* Demo / Clear */
	function seedDemo() {
		const demo = [
			{ name: 'White Oxford Shirt', category: 'top', color: 'White', formality: 'smart-casual', warmth: 'light', brand: 'Uniqlo', cost: 35 },
			{ name: 'Navy Chinos', category: 'bottom', color: 'Navy', formality: 'smart-casual', warmth: 'medium', brand: 'J.Crew', cost: 70 },
			{ name: 'Black Blazer', category: 'outerwear', color: 'Black', formality: 'business', warmth: 'warm', brand: 'Zara', cost: 120 },
			{ name: 'White Sneakers', category: 'shoes', color: 'White', formality: 'casual', warmth: 'light', brand: 'Nike', cost: 80 },
			{ name: 'Brown Leather Belt', category: 'accessory', color: 'Brown', formality: 'smart-casual', warmth: 'light', brand: 'Andersons', cost: 60 },
			{ name: 'Floral Dress', category: 'dress', color: 'Red', formality: 'smart-casual', warmth: 'light', brand: 'Reformation', cost: 180 }
		].map(x => ({
			...x, id: uid(), imageUrl: '', wearCount: Math.floor(Math.random()*3),
			lastWornAt: Date.now() - Math.floor(Math.random()*100)*86400000,
			createdAt: Date.now() - Math.floor(Math.random()*300)*86400000
		}));
		saveItems(demo);
		renderWardrobe();
		renderSell();
		buildDeck();
	}
	function clearAll() {
		if (!confirm('Clear all wardrobe data?')) return;
		localStorage.removeItem(STORAGE_KEY);
		renderWardrobe(); renderSell(); buildDeck();
	}

	/* Wire up UI */
	function initTabs() {
		document.querySelectorAll('.tab').forEach(t => {
			t.addEventListener('click', () => {
				activateTab(t.dataset.tab);
				if (t.dataset.tab === 'view-wardrobe') renderWardrobe();
				if (t.dataset.tab === 'view-sell') renderSell();
			});
		});
	}

	function init() {
		initTabs();

		$('#seedBtn').addEventListener('click', seedDemo);
		$('#settingsBtn').addEventListener('click', () => alert('Settings coming soon'));
		$('#refreshDeckBtn').addEventListener('click', buildDeck);
		$('#btnLike').addEventListener('click', () => {
			const topCard = qs('.card:last-child', $('#deck'));
			if (!topCard) return;
			const outfit = deck[0];
			onLike(outfit, topCard);
		});
		$('#btnNope').addEventListener('click', () => {
			const topCard = qs('.card:last-child', $('#deck'));
			if (!topCard) return;
			onNope(topCard);
		});

		$('#addOpenBtn').addEventListener('click', openSheet);
		$('#addCloseBtn').addEventListener('click', closeSheet);
		$('#addForm').addEventListener('submit', submitAdd);
		$('#clearBtn').addEventListener('click', clearAll);

		$('#searchInput').addEventListener('input', renderWardrobe);
		$('#filterCategory').addEventListener('change', renderWardrobe);

		// First render
		renderWardrobe();
		renderSell();
		buildDeck();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else { init(); }
})();
