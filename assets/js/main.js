let allFoods = [];
let allCategories = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

const navbar = document.getElementById('navbar');
const announcement = document.getElementById('announcement');

if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            navbar.classList.add('shadow-md');
            if (announcement) {
                announcement.style.maxHeight = '0';
                announcement.style.paddingTop = '0';
                announcement.style.paddingBottom = '0';
                announcement.style.opacity = '0';
            }
        } else {
            navbar.classList.remove('shadow-md');
            if (announcement) {
                announcement.style.maxHeight = '60px';
                announcement.style.paddingTop = '';
                announcement.style.paddingBottom = '';
                announcement.style.opacity = '1';
            }
        }
    });
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.add('hidden');
}

function getFoodImageSmart(food) {
    if (!food) return PLACEHOLDER_IMG;
    const key = 'food_' + food.id;
    const local = getLocalImage(key);
    if (local) return local;
    return getFoodImage(food.image);
}

async function loadCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    try {
        const res = await apiRequest(API.categories);
        allCategories = res.data || res;

        let html = '<button onclick="filterByCategory(null)" class="cat-btn cat-btn-active px-6 py-2.5 rounded-full font-bold text-sm bg-tb-orange text-white border-2 border-tb-orange transition-all" data-id="all">الكل</button>';

        allCategories.forEach(cat => {
            html += '<button onclick="filterByCategory(' + cat.id + ')" class="cat-btn px-6 py-2.5 rounded-full font-bold text-sm bg-white text-tb-black border-2 border-tb-grayLight hover:border-tb-orange hover:text-tb-orange transition-all" data-id="' + cat.id + '">' + cat.name + '</button>';
        });

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p class="text-red-500 font-bold">فشل تحميل الأصناف</p>';
    }
}

async function loadFoods(categoryId) {
    const container = document.getElementById('foods-container');
    if (!container) return;

    let serverFoods = [];
    try {
        const url = categoryId ? API.foods + '?category_id=' + categoryId : API.foods;
        const res = await apiRequest(url);
        serverFoods = res.data || res;
    } catch (err) {
        console.warn('Server unavailable, using local data');
    }

    let localFoods = [];
    try { localFoods = JSON.parse(localStorage.getItem('local_foods') || '[]'); } catch {}

    localFoods.forEach(lf => {
        if (categoryId && lf.category_id != categoryId) return;
        if (!serverFoods.find(f => f.id == lf.id)) serverFoods.push(lf);
    });

    allFoods = serverFoods;

    if (!allFoods.length) {
        container.innerHTML = '<p class="col-span-full text-center text-tb-grayText py-10 font-bold">لا توجد وجبات</p>';
        return;
    }

    container.innerHTML = allFoods.map(food => {
        const imgSrc = getFoodImageSmart(food);
        return `
            <div class="food-card bg-white rounded-2xl overflow-hidden border border-tb-grayLight cursor-pointer">
                <div class="relative h-44 bg-tb-gray overflow-hidden">
                    <img src="${imgSrc}" alt="${escapeHtml(food.name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                    <span class="absolute top-3 right-3 bg-white text-tb-black font-bold px-3 py-1 rounded-full text-xs shadow-sm">${escapeHtml(food.category_name || 'مميز')}</span>
                </div>
                <div class="p-4">
                    <h3 class="text-base font-black text-tb-black mb-1 truncate">${escapeHtml(food.name)}</h3>
                    <p class="text-sm text-tb-grayText mb-3 line-clamp-1 font-semibold">${escapeHtml(food.description || 'طبق شهي ولذيذ')}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xl font-black text-tb-black">${escapeHtml(food.price)} <span class="text-xs text-tb-grayText">EGP</span></span>
                        <button onclick="event.stopPropagation();addToCart('${food.id}')" class="w-10 h-10 bg-tb-orange hover:bg-tb-orangeDark text-white rounded-full flex items-center justify-center transition shadow-md">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterByCategory(id) {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        const isActive = (id === null && btn.dataset.id === 'all') || btn.dataset.id == id;
        if (isActive) {
            btn.className = 'cat-btn cat-btn-active px-6 py-2.5 rounded-full font-bold text-sm bg-tb-orange text-white border-2 border-tb-orange transition-all';
        } else {
            btn.className = 'cat-btn px-6 py-2.5 rounded-full font-bold text-sm bg-white text-tb-black border-2 border-tb-grayLight hover:border-tb-orange hover:text-tb-orange transition-all';
        }
    });
    loadFoods(id);
}

function addToCart(foodId) {
    const food = allFoods.find(f => f.id == foodId);
    if (!food) return;

    const existing = cart.find(i => i.food_id == foodId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ food_id: food.id, name: food.name, price: food.price, image: food.image, quantity: 1 });
    }
    saveCart();
    showToast('تم إضافة الوجبة للسلة');
}

function removeFromCart(foodId) {
    cart = cart.filter(i => i.food_id != foodId);
    saveCart();
}

function updateQty(foodId, change) {
    const item = cart.find(i => i.food_id == foodId);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) return removeFromCart(foodId);
    saveCart();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const count = document.getElementById('cart-count');
    const total = document.getElementById('cart-total');
    if (!container || !count || !total) return;

    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    count.textContent = totalQty;
    count.style.display = totalQty ? 'flex' : 'none';

    if (!cart.length) {
        container.innerHTML = `
            <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
                    <svg class="w-10 h-10 text-tb-grayLight" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                </div>
                <p class="text-tb-grayText font-bold">السلة فاضية</p>
                <p class="text-tb-grayText text-sm mt-1 font-semibold">أضف بعض الأطباق الشهية</p>
            </div>`;
        total.textContent = '0 EGP';
        return;
    }

    let totalPrice = 0;
    container.innerHTML = cart.map(item => {
        totalPrice += item.price * item.quantity;
        const imgSrc = getLocalImage('food_' + item.food_id) || getFoodImage(item.image);
        return `
            <div class="flex gap-3 p-3 bg-white rounded-xl border border-tb-grayLight">
                <img src="${imgSrc}" class="w-20 h-20 rounded-lg object-cover" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <p class="font-black text-tb-black text-sm truncate">${escapeHtml(item.name)}</p>
                        <button onclick="removeFromCart('${item.food_id}')" class="text-tb-grayText hover:text-red-500 transition shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                    <p class="text-tb-orange font-black text-sm mt-0.5">${item.price} EGP</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="updateQty('${item.food_id}', -1)" class="w-7 h-7 bg-white border-2 border-tb-grayLight rounded-lg font-bold hover:border-tb-orange hover:text-tb-orange transition flex items-center justify-center">−</button>
                        <span class="font-black text-tb-black w-6 text-center text-sm">${item.quantity}</span>
                        <button onclick="updateQty('${item.food_id}', 1)" class="w-7 h-7 bg-tb-orange text-white rounded-lg font-bold hover:bg-tb-orangeDark transition flex items-center justify-center">+</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    total.textContent = totalPrice + ' EGP';
}

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (!sidebar || !overlay) return;

    const isClosing = sidebar.classList.contains('-translate-x-full');

    sidebar.classList.toggle('-translate-x-full');
    if (isClosing) {
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
        document.body.style.overflow = 'hidden';
    } else {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        document.body.style.overflow = '';
    }
}

function checkout() {
    if (!cart.length) return showToast('السلة فاضية!', 'warning');
    toggleCart();
    setTimeout(() => {
        const modal = document.getElementById('checkout-modal');
        const content = document.getElementById('checkout-content');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (content) requestAnimationFrame(() => content.classList.remove('scale-95'));
    }, 300);
}

function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-content');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الإرسال...';

    const payload = {
        customer_name: document.getElementById('customer_name').value,
        customer_phone: document.getElementById('customer_phone').value,
        customer_address: document.getElementById('customer_address').value,
        items: cart.map(i => ({ food_id: i.food_id, quantity: i.quantity }))
    };

    try {
        await apiRequest(API.orders, { method: 'POST', body: JSON.stringify(payload) });
        cart = [];
        saveCart();
        closeCheckout();
        showToast('تم إرسال طلبك بنجاح');
        form.reset();
    } catch (err) {
        showToast(err.message || 'حدث خطأ', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'تأكيد';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadFoods();
    renderCart();
});