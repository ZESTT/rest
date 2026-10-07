const API_BASE_URL = "/api";
const savedUrl = localStorage.getItem('API_BASE_URL');
const FINAL_API_URL = savedUrl || API_BASE_URL;

const API = {
    base:       FINAL_API_URL,
    register:   `${FINAL_API_URL}/register.php`,
    login:      `${FINAL_API_URL}/login.php`,
    logout:     `${FINAL_API_URL}/logout.php`,
    foods:      `${FINAL_API_URL}/foods.php`,
    categories: `${FINAL_API_URL}/categories.php`,
    orders:     `${FINAL_API_URL}/orders.php`,
};

async function apiRequest(url, options = {}) {
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers || {})
        },
        ...options,
    };
    try {
        const response = await fetch(url, config);
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch { data = { raw: text }; }
        if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
        return data;
    } catch (error) {
        console.error('API Error:', url, error);
        throw error;
    }
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80';

function getFoodImage(imageName) {
    if (!imageName || typeof imageName !== 'string' || !imageName.trim()) return PLACEHOLDER_IMG;
    if (imageName.startsWith('http://') || imageName.startsWith('https://') || imageName.startsWith('data:')) return imageName;
    const base = API.base.replace(/\/$/, '');
    return `${base}/../uploads/${imageName}`;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
    const cfg = {
        success: { bg: 'from-emerald-500 to-teal-500', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
        error:   { bg: 'from-rose-500 to-red-500',       icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
        info:    { bg: 'from-sky-500 to-blue-500',        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
        warning: { bg: 'from-amber-500 to-orange-500',    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>' }
    };
    const c = cfg[type] || cfg.success;

    const toast = document.createElement('div');
    toast.className = `fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-semibold shadow-2xl bg-gradient-to-r ${c.bg} transform translate-x-[150%] transition-transform duration-500 ease-out backdrop-blur-xl`;
    toast.innerHTML = `
        <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${c.icon}</svg>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    setTimeout(() => {
        toast.style.transform = 'translateX(150%)';
        setTimeout(() => toast.remove(), 500);
    }, 3200);
}

const LOCAL_IMAGES_KEY = 'local_food_images';

function getLocalImagesMap() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_IMAGES_KEY) || '{}');
    } catch { return {}; }
}

function saveLocalImage(key, base64) {
    const map = getLocalImagesMap();
    map[key] = base64;
    try {
        localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(map));
    } catch (e) {
        console.warn('localStorage full, skipping image save');
    }
}

function getLocalImage(key) {
    if (!key) return null;
    const map = getLocalImagesMap();
    return map[key] || null;
}

function removeLocalImage(key) {
    const map = getLocalImagesMap();
    delete map[key];
    try {
        localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(map));
    } catch {}
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = (maxWidth / w) * h;
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadImageSmart(file, foodIdentifier) {
    const status = document.getElementById('upload-status');
    const setStatus = (text, color) => {
        if (!status) return;
        status.classList.remove('hidden');
        status.className = 'mt-2 text-xs font-bold ' + color;
        status.textContent = text;
    };

    setStatus('جاري معالجة الصورة...', 'text-tb-orange');

    let base64 = null;
    try {
        base64 = await compressImage(file, 800, 0.8);
    } catch (e) {
        base64 = await fileToBase64(file);
    }

    if (foodIdentifier) {
        saveLocalImage(foodIdentifier, base64);
    }

    setStatus('جاري محاولة الرفع للسيرفر...', 'text-tb-orange');

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(API.base + '/upload.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (res.ok) {
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch {}

            const filename = data.filename || data.image || data.data?.filename || data.data;
            if (filename && typeof filename === 'string') {
                setStatus('تم رفع الصورة للسيرفر ✓', 'text-green-600');
                return { type: 'file', value: filename };
            }
        }
    } catch (e) {
        console.warn('Upload endpoint failed, using base64 fallback');
    }

    setStatus('تم الحفظ محلياً ✓', 'text-green-600');
    return { type: 'base64', value: base64 };
}