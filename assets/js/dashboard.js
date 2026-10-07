let foodsData = [];
let categoriesData = [];
let ordersData = [];
let selectedImageFile = null;
let currentFoodKey = null;

function extractArray(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.foods)) return res.foods;
    if (Array.isArray(res.categories)) return res.categories;
    if (Array.isArray(res.orders)) return res.orders;
    return [];
}

function safeText(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFoodImageSmart(food) {
    if (!food) return PLACEHOLDER_IMG;
    const key = 'food_' + food.id;
    const local = getLocalImage(key);
    if (local) return local;
    return getFoodImage(food.image);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector('[data-section="' + section + '"]');
    if (link) link.classList.add('active');

    const titles = { overview: 'نظرة عامة', foods: 'الوجبات', categories: 'الأصناف', orders: 'الطلبات' };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = titles[section] || '';

    if (window.innerWidth < 1024) toggleSidebar();

    if (section === 'foods') loadFoodsAdmin();
    if (section === 'categories') loadCategoriesAdmin();
    if (section === 'orders') loadOrders();
    if (section === 'overview') loadStats();
}

async function loadStats() {
    try {
        const results = await Promise.all([
            apiRequest(API.foods).catch(() => ({ data: [] })),
            apiRequest(API.categories).catch(() => ({ data: [] })),
            apiRequest(API.orders).catch(() => ({ data: [] }))
        ]);

        foodsData = extractArray(results[0]);
        categoriesData = extractArray(results[1]);
        ordersData = extractArray(results[2]);

        const sf = document.getElementById('stat-foods');
        const sc = document.getElementById('stat-categories');
        const so = document.getElementById('stat-orders');
        const sr = document.getElementById('stat-revenue');

        if (sf) sf.textContent = foodsData.length;
        if (sc) sc.textContent = categoriesData.length;
        if (so) so.textContent = ordersData.length;

        let revenue = 0;
        ordersData.forEach(function(o) {
            const val = parseFloat(o.total || o.price || 0);
            if (!isNaN(val)) revenue += val;
        });
        if (sr) sr.textContent = revenue.toFixed(0) + ' EGP';
    } catch (e) {
        console.error(e);
    }
}

async function loadFoodsAdmin() {
    const container = document.getElementById('foods-list');
    if (!container) return;

    container.innerHTML = '<div class="bg-white rounded-2xl h-32 skeleton"></div><div class="bg-white rounded-2xl h-32 skeleton"></div><div class="bg-white rounded-2xl h-32 skeleton"></div>';

    let serverFoods = [];
    try {
        const res = await apiRequest(API.foods);
        serverFoods = extractArray(res);
    } catch (e) {
        console.warn('Server unavailable, using local data');
    }

    let localFoods = [];
    try { localFoods = JSON.parse(localStorage.getItem('local_foods') || '[]'); } catch {}

    const merged = [...serverFoods];
    localFoods.forEach(lf => {
        if (!merged.find(f => f.id == lf.id)) merged.push(lf);
    });

    foodsData = merged;

    if (!foodsData.length) {
        container.innerHTML = '<p class="col-span-full text-center text-tb-grayText py-10 font-bold">لا توجد وجبات</p>';
        return;
    }

    let html = '';
    foodsData.forEach(function(food) {
        const imgSrc = getFoodImageSmart(food);
        const idAttr = JSON.stringify(food.id).replace(/"/g, '&quot;');
        html += '<div class="bg-white rounded-2xl p-4 border border-tb-grayLight hover:shadow-md transition flex gap-4">';
        html += '<img src="' + imgSrc + '" class="w-20 h-20 rounded-xl object-cover shrink-0" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_IMG + '\'">';
        html += '<div class="flex-1 min-w-0 flex flex-col">';
        html += '<h3 class="font-black text-tb-black truncate">' + safeText(food.name) + '</h3>';
        html += '<p class="text-xs text-tb-grayText truncate font-semibold">' + safeText(food.description || '') + '</p>';
        html += '<p class="text-tb-orange font-black text-base mt-1">' + safeText(food.price) + ' EGP</p>';
        html += '<div class="flex gap-2 mt-auto pt-2">';
        html += '<button onclick="editFood(' + idAttr + ')" class="flex-1 py-1.5 rounded-lg bg-tb-gray text-tb-black text-xs font-bold hover:bg-tb-orange hover:text-white transition">تعديل</button>';
        html += '<button onclick="deleteFood(' + idAttr + ')" class="flex-1 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-500 hover:text-white transition">حذف</button>';
        html += '</div></div></div>';
    });
    container.innerHTML = html;
}

function openFoodModal(food) {
    food = food || null;
    selectedImageFile = null;
    currentFoodKey = food ? 'food_' + food.id : null;

    document.getElementById('food-modal-title').textContent = food ? 'تعديل وجبة' : 'إضافة وجبة';
    document.getElementById('food-id').value = food ? food.id : '';
    document.getElementById('food-name').value = food ? food.name : '';
    document.getElementById('food-desc').value = food ? (food.description || '') : '';
    document.getElementById('food-price').value = food ? food.price : '';
    document.getElementById('food-image').value = food ? (food.image || '') : '';

    const sel = document.getElementById('food-category');
    let opts = '<option value="">اختر</option>';
    categoriesData.forEach(function(c) {
        const selected = (food && food.category_id == c.id) ? 'selected' : '';
        opts += '<option value="' + c.id + '" ' + selected + '>' + safeText(c.name) + '</option>';
    });
    sel.innerHTML = opts;

    resetImagePreview();

    if (food && food.image) {
        showImagePreview(getFoodImageSmart(food));
    } else if (currentFoodKey) {
        const local = getLocalImage(currentFoodKey);
        if (local) showImagePreview(local);
    }

    document.getElementById('food-modal').classList.remove('hidden');
    document.getElementById('food-modal').classList.add('flex');
}

function showImagePreview(src) {
    const placeholder = document.getElementById('image-placeholder');
    const wrap = document.getElementById('image-preview-wrap');
    const preview = document.getElementById('image-preview');
    if (!placeholder || !wrap || !preview) return;
    placeholder.classList.add('hidden');
    wrap.classList.remove('hidden');
    preview.src = src;
}

function resetImagePreview() {
    const placeholder = document.getElementById('image-placeholder');
    const wrap = document.getElementById('image-preview-wrap');
    const input = document.getElementById('food-image-file');
    const status = document.getElementById('upload-status');
    if (placeholder) placeholder.classList.remove('hidden');
    if (wrap) wrap.classList.add('hidden');
    if (input) input.value = '';
    if (status) { status.classList.add('hidden'); status.textContent = ''; }
    selectedImageFile = null;
}

function removeImagePreview() {
    resetImagePreview();
    document.getElementById('food-image').value = '';
    if (currentFoodKey) removeLocalImage(currentFoodKey);
}

document.getElementById('food-image-file')?.addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('الملف ليس صورة', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الصورة أكبر من 5 ميجا', 'error');
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function(ev) {
        showImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
});

function editFood(id) {
    const food = foodsData.find(function(f) { return f.id == id; });
    if (food) openFoodModal(food);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveLocalFoodFallback(payload, id) {
    const key = 'local_foods';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}

    if (id) {
        const idx = list.findIndex(f => f.id == id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
        else list.push({ id: id, ...payload });
    } else {
        const newId = 'local_' + Date.now();
        list.push({ id: newId, ...payload });
    }
    try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

document.getElementById('food-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('food-submit-btn');
    const id = document.getElementById('food-id').value;

    const priceVal = parseFloat(document.getElementById('food-price').value);
    if (isNaN(priceVal)) { showToast('السعر غير صحيح', 'error'); return; }

    const catVal = parseInt(document.getElementById('food-category').value);
    if (isNaN(catVal)) { showToast('اختر الصنف', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الحفظ...';

    try {
        let imageValue = document.getElementById('food-image').value.trim();
        let tempKey = id ? 'food_' + id : 'food_temp_' + Date.now();

        if (selectedImageFile) {
            const result = await uploadImageSmart(selectedImageFile, tempKey);
            imageValue = result.value;
            document.getElementById('food-image').value = imageValue;
        }

        const payload = {
            name: document.getElementById('food-name').value.trim(),
            description: document.getElementById('food-desc').value.trim(),
            price: priceVal,
            image: imageValue,
            category_id: catVal
        };

        if (!payload.name) {
            showToast('اسم الوجبة مطلوب', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ';
            return;
        }

        let savedResponse = null;
        try {
            if (id) {
                savedResponse = await apiRequest(API.foods + '?id=' + id + '&_method=PUT', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                showToast('تم التعديل بنجاح');
            } else {
                savedResponse = await apiRequest(API.foods, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                showToast('تمت الإضافة بنجاح');
            }
        } catch (apiErr) {
            console.warn('API save failed, saving locally:', apiErr);
            saveLocalFoodFallback(payload, id);
            showToast('تم الحفظ محلياً - السيرفر غير متاح', 'warning');
        }

        if (selectedImageFile && tempKey && tempKey !== 'food_' + id) {
            const realId = savedResponse?.id || savedResponse?.data?.id || savedResponse?.food_id;
            if (realId) {
                const base64 = getLocalImage(tempKey);
                if (base64) {
                    removeLocalImage(tempKey);
                    saveLocalImage('food_' + realId, base64);
                }
            }
        }

        closeModal('food-modal');
        form.reset();
        resetImagePreview();
        loadFoodsAdmin();
    } catch (err) {
        showToast(err.message || 'حدث خطأ', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ';
    }
});

async function deleteFood(id) {
    if (!confirm('تأكيد الحذف؟')) return;

    const isLocal = typeof id === 'string' && id.startsWith('local_');
    const key = 'food_' + id;
    removeLocalImage(key);

    if (isLocal) {
        try {
            let list = JSON.parse(localStorage.getItem('local_foods') || '[]');
            list = list.filter(f => f.id != id);
            localStorage.setItem('local_foods', JSON.stringify(list));
            showToast('تم الحذف محلياً');
        } catch {}
        loadFoodsAdmin();
        return;
    }

    try {
        await apiRequest(API.foods + '?id=' + id, { method: 'DELETE' });
        showToast('تم الحذف');
        loadFoodsAdmin();
    } catch (err) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem('local_foods') || '[]'); } catch {}
        list = list.filter(f => f.id != id);
        try { localStorage.setItem('local_foods', JSON.stringify(list)); } catch {}
        showToast('تم الحذف محلياً - السيرفر غير متاح', 'warning');
        loadFoodsAdmin();
    }
}

async function loadCategoriesAdmin() {
    const container = document.getElementById('categories-list');
    if (!container) return;

    try {
        const res = await apiRequest(API.categories);
        categoriesData = extractArray(res);

        if (!categoriesData.length) {
            container.innerHTML = '<p class="col-span-full text-center text-tb-grayText py-10 font-bold">لا توجد أصناف</p>';
            return;
        }

        let html = '';
        categoriesData.forEach(function(cat) {
            html += '<div class="bg-white rounded-2xl p-5 border border-tb-grayLight hover:shadow-md transition">';
            html += '<div class="w-10 h-10 rounded-xl bg-tb-orangeSoft flex items-center justify-center mb-3">';
            html += '<svg class="w-5 h-5 text-tb-orange" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>';
            html += '</div>';
            html += '<h3 class="font-black text-tb-black text-base">' + safeText(cat.name) + '</h3>';
            html += '<p class="text-xs text-tb-grayText mt-1 mb-4 font-semibold">' + safeText(cat.description || 'لا يوجد وصف') + '</p>';
            html += '<div class="flex gap-2">';
            html += '<button onclick="editCategory(' + cat.id + ')" class="flex-1 py-2 rounded-lg bg-tb-gray text-tb-black text-xs font-bold hover:bg-tb-orange hover:text-white transition">تعديل</button>';
            html += '<button onclick="deleteCategory(' + cat.id + ')" class="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-500 hover:text-white transition">حذف</button>';
            html += '</div></div>';
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p class="text-red-500 text-center py-10 font-bold">فشل التحميل</p>';
    }
}

function openCategoryModal(cat) {
    cat = cat || null;
    document.getElementById('category-modal-title').textContent = cat ? 'تعديل صنف' : 'إضافة صنف';
    document.getElementById('category-id').value = cat ? cat.id : '';
    document.getElementById('category-name').value = cat ? cat.name : '';
    document.getElementById('category-desc').value = cat ? (cat.description || '') : '';
    document.getElementById('category-modal').classList.remove('hidden');
    document.getElementById('category-modal').classList.add('flex');
}

function editCategory(id) {
    const cat = categoriesData.find(function(c) { return c.id == id; });
    if (cat) openCategoryModal(cat);
}

document.getElementById('category-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('category-id').value;
    const payload = {
        name: document.getElementById('category-name').value.trim(),
        description: document.getElementById('category-desc').value.trim()
    };

    if (!payload.name) { showToast('اسم الصنف مطلوب', 'error'); return; }

    try {
        if (id) {
            await apiRequest(API.categories + '?id=' + id + '&_method=PUT', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showToast('تم التعديل بنجاح');
        } else {
            await apiRequest(API.categories, { method: 'POST', body: JSON.stringify(payload) });
            showToast('تمت الإضافة بنجاح');
        }
        closeModal('category-modal');
        form.reset();
        loadCategoriesAdmin();
    } catch (err) {
        showToast(err.message || 'حدث خطأ', 'error');
    }
});

async function deleteCategory(id) {
    if (!confirm('تأكيد الحذف؟')) return;
    try {
        await apiRequest(API.categories + '?id=' + id, { method: 'DELETE' });
        showToast('تم الحذف');
        loadCategoriesAdmin();
    } catch (err) {
        showToast(err.message || 'فشل الحذف', 'error');
    }
}

async function loadOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    container.innerHTML = '<div class="bg-white rounded-2xl h-24 skeleton mb-3"></div><div class="bg-white rounded-2xl h-24 skeleton mb-3"></div><div class="bg-white rounded-2xl h-24 skeleton mb-3"></div>';

    try {
        const res = await apiRequest(API.orders);
        ordersData = extractArray(res);

        if (!ordersData.length) {
            container.innerHTML = '<p class="text-center text-tb-grayText py-10 font-bold">لا توجد طلبات</p>';
            return;
        }

        let html = '';
        ordersData.forEach(function(order) {
            const total = parseFloat(order.total || 0);
            html += '<div class="bg-white rounded-2xl p-5 border border-tb-grayLight hover:shadow-md transition">';
            html += '<div class="flex justify-between items-start flex-wrap gap-3">';
            html += '<div class="flex items-start gap-3">';
            html += '<div class="w-11 h-11 rounded-xl bg-tb-orangeSoft flex items-center justify-center shrink-0">';
            html += '<svg class="w-6 h-6 text-tb-orange" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
            html += '</div>';
            html += '<div>';
            html += '<p class="font-black text-tb-black">طلب #' + safeText(order.id) + '</p>';
            html += '<p class="text-sm text-tb-black font-bold mt-0.5">' + safeText(order.customer_name || '') + '</p>';
            html += '<div class="flex flex-wrap gap-3 mt-1.5 text-xs text-tb-grayText font-semibold">';
            html += '<span>📞 ' + safeText(order.customer_phone || '') + '</span>';
            html += '<span>📍 ' + safeText(order.customer_address || '') + '</span>';
            html += '</div></div></div>';
            html += '<span class="inline-block bg-tb-orange text-white font-black px-3 py-1.5 rounded-lg text-sm">' + total.toFixed(0) + ' EGP</span>';
            html += '</div></div>';
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p class="text-red-500 text-center py-10 font-bold">فشل التحميل</p>';
    }
}

async function logout() {
    try { await apiRequest(API.logout, { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('cart');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', function() {
    loadStats();
});