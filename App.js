// ===== Post Servisi =====
// API ilə əlaqə qurmaq üçün istifadə olunan servis obyekti.
// Bütün HTTP sorğuları bu obyekt vasitəsilə göndərilir.
const PostService = {
    BASE_URL: 'https://jsonplaceholder.typicode.com',

    /**
     * Bütün postları API-dən gətirir.
     * @returns {Promise<Array>} - Postlar massivi
     */
    async getPosts() {
        const response = await fetch(`${this.BASE_URL}/posts`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    /**
     * Bütün istifadəçiləri API-dən gətirir.
     * @returns {Promise<Array>} - İstifadəçilər massivi
     */
    async getUsers() {
        const response = await fetch(`${this.BASE_URL}/users`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    /**
     * Müəyyən bir posta aid şərhləri API-dən gətirir.
     * @param {number} postId - Postun ID-si
     * @returns {Promise<Array>} - Şərhlər massivi
     */
    async getComments(postId) {
        const response = await fetch(`${this.BASE_URL}/posts/${postId}/comments`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
};

// ===== DOM Elementləri =====
// HTML-dəki elementləri seçmək üçün qısa yardımçı funksiya
const $ = (sel) => document.querySelector(sel);

// Əsas səhifə elementləri
const postsGrid = $('#postsGrid');           // Postların göstəriləcəyi grid konteyner
const loader = $('#loader');                 // Yüklənmə animasiyası
const errorState = $('#errorState');         // Xəta mesajı hissəsi
const errorText = $('#errorText');           // Xəta mətni
const emptyState = $('#emptyState');         // Boş nəticə mesajı
const retryBtn = $('#retryBtn');             // Yenidən cəhd düyməsi
const searchInput = $('#searchInput');       // Axtarış sahəsi
const postCount = $('#postCount');           // Post sayı göstəricisi

// Modal (açılan pəncərə) elementləri
const modalOverlay = $('#modalOverlay');     // Modal arxa fonu
const modalClose = $('#modalClose');         // Modal bağlama düyməsi
const modalTitle = $('#modalTitle');         // Modal başlığı
const modalBody = $('#modalBody');           // Modal məzmunu
const modalUser = $('#modalUser');           // Modal istifadəçi adı
const commentsLoader = $('#commentsLoader'); // Şərhlərin yüklənmə animasiyası
const commentsList = $('#commentsList');     // Şərhlər siyahısı

// ===== Vəziyyət (State) =====
let allPosts = [];   // Bütün postları saxlayan massiv
let usersMap = {};   // İstifadəçi məlumatlarını ID-yə görə saxlayan obyekt

/**
 * İstifadəçinin adından baş hərfləri çıxarır.
 * Məsələn: "Nurlan Əliyev" -> "NƏ"
 * @param {string} name - İstifadəçinin tam adı
 * @returns {string} - Baş hərflər (maksimum 2 hərf)
 */
function getInitials(name) {
    return name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Hər istifadəçi üçün unikal gradient rəng qaytarır.
 * İstifadəçi ID-sinə əsasən rəng seçilir.
 * @param {number} userId - İstifadəçinin ID-si
 * @returns {string} - CSS gradient dəyəri
 */
function getColorForUser(userId) {
    const colors = [
        'linear-gradient(135deg, #6c5ce7, #a29bfe)',
        'linear-gradient(135deg, #00cec9, #55efc4)',
        'linear-gradient(135deg, #fd79a8, #e84393)',
        'linear-gradient(135deg, #fdcb6e, #f39c12)',
        'linear-gradient(135deg, #74b9ff, #0984e3)',
        'linear-gradient(135deg, #ff7675, #d63031)',
        'linear-gradient(135deg, #55efc4, #00b894)',
        'linear-gradient(135deg, #dfe6e9, #b2bec3)',
        'linear-gradient(135deg, #fab1a0, #e17055)',
        'linear-gradient(135deg, #81ecec, #00cec9)',
    ];
    return colors[(userId - 1) % colors.length];
}

// ===== UI Göstərmə Funksiyaları =====

/**
 * Yüklənmə animasiyasını göstərir və digər vəziyyətləri gizlədir.
 * Məlumat gətirilərkən çağırılır.
 */
function showLoader() {
    loader.style.display = 'flex';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    postsGrid.innerHTML = '';
}

/**
 * Yüklənmə animasiyasını gizlədir.
 * Məlumat uğurla gətirildikdən sonra çağırılır.
 */
function hideLoader() {
    loader.style.display = 'none';
}
/**
 * Xəta mesajını ekranda göstərir.
 * @param {string} message - Göstəriləcək xəta mətni
 */
function showError(message) {
    hideLoader();
    errorText.textContent = message;
    errorState.style.display = 'block';
}

/**
 * Boş nəticə mesajını göstərir.
 * Axtarış nəticəsi tapılmadıqda çağırılır.
 */
function showEmpty() {
    hideLoader();
    emptyState.style.display = 'block';
}

/**
 * Boş nəticə mesajını gizlədir.
 */
function hideEmpty() {
    emptyState.style.display = 'none';
}

// ===== Post Kartı Yaratma =====

/**
 * Bir post üçün kartı (HTML elementi) yaradır.
 * Kart tıklandıqda modal pəncərə açılır.
 * @param {Object} post - API-dən gələn post obyekti
 * @returns {HTMLElement} - Yaradılmış kart elementi
 */
function createPostCard(post) {
    const user = usersMap[post.userId] || { name: `İstifadəçi ${post.userId}` };
    const initials = getInitials(user.name);
    const avatarBg = getColorForUser(post.userId);

    const card = document.createElement('div');
    card.className = 'post-card';
    card.style.animationDelay = `${(post._index || 0) * 0.05}s`;
    card.innerHTML = `
        <div class="post-card__user">
            <span class="post-card__user-avatar" style="background:${avatarBg}">${initials}</span>
            ${user.name}
        </div>
        <h2 class="post-card__title">${post.title}</h2>
        <p class="post-card__excerpt">${post.body}</p>
        <div class="post-card__footer">
            <span class="post-card__id">#${post.id}</span>
            <span class="post-card__read">ətraflı →</span>
        </div>
    `;

    // Karta tıklandıqda modal açılır
    card.addEventListener('click', () => openModal(post));
    return card;
}
// ===== Postları Ekranda Göstərmə =====

/**
 * Postlar massivini alıb ekrandakı grid-ə render edir.
 * Hər post üçün kart yaradılır və əlavə olunur.
 * @param {Array} posts - Göstəriləcək postların massivi
 */
function renderPosts(posts) {
    postsGrid.innerHTML = '';
    hideEmpty();

    // Əgər post yoxdursa, boş noticə mesajı göstərilir
    if (posts.length === 0) {
        showEmpty();
        postCount.textContent = '0 post';
        return;
    }

    // Post sayını yeniləyirik
    postCount.textContent = `${posts.length} post`;

    // Hər post üçün kart yaradılır və grid-ə əlavə olunur
    posts.forEach((post, i) => {
        post._index = i;
        postsGrid.appendChild(createPostCard(post));
    });
}

// ===== Modal (Açılan Pəncərə) Funksiyaları =====

/**
 * Seçilmiş postun detallarını modal pəncərədə açır.
 * Eyni zamanda postun şərhlərini yükləyir.
 * @param {Object} post - Açılacaq post obyekti
 */
function openModal(post) {
    const user = usersMap[post.userId] || { name: `İstifadəçi ${post.userId}` };
    modalUser.textContent = `👤 ${user.name}`;
    modalTitle.textContent = post.title;
    modalBody.textContent = post.body;
    commentsList.innerHTML = '';
    commentsLoader.style.display = 'flex';

    // Modalı açırıq və arxa fonu scroll-dan qoruyuruq
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Şərhləri yükləyirik
    loadComments(post.id);
}

/**
 * Modal pəncərəsini bağlayır və scroll-u bərpa edir.
 */
function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}
/**
 * Postun şərhlərini API-dən gətirib modal-da göstərir.
 * @param {number} postId - Şərhləri yüklənəcək postun ID-si
 */
async function loadComments(postId) {
    try {
        const comments = await PostService.getComments(postId);
        commentsLoader.style.display = 'none';

        // Şərh yoxdursa müvafiq mesaj göstərilir
        if (comments.length === 0) {
            commentsList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Şərh yoxdur</p>';
            return;
        }

        // Hər şərh üçün kart yaradılır və siyahıya əlavə olunur
        commentsList.innerHTML = comments
            .map((c) => {
                const initials = getInitials(c.name);
                return `
                    <div class="comment-card">
                        <div class="comment-card__header">
                            <span class="comment-card__avatar">${initials}</span>
                            <div class="comment-card__meta">
                                <div class="comment-card__name">${c.name}</div>
                                <div class="comment-card__email">${c.email}</div>
                            </div>
                        </div>
                        <p class="comment-card__body">${c.body}</p>
                    </div>
                `;
            })
            .join('');

    } catch {
        // Xəta baş verdikdə istifadəçiyə bildiriş göstərilir
        commentsLoader.style.display = 'none';
        commentsList.innerHTML = '<p style="color:var(--danger);font-size:0.85rem">Şərhlər yüklənə bilmədi</p>';
    }
}
/**
 * Axtarış sahəsinə yazılan mətnə görə postları filtrləyir.
 * Postun başlığı, mətni və ya müəllifin adında axtarılır.
 */
function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();

    // Axtarış sahəsi boşdursa, bütün postları göstər
    if (!query) {
        renderPosts(allPosts);
        return;
    }

    // Başlıq, mətn və ya istifadəçi adına görə filtrləyirik
    const filtered = allPosts.filter((post) => {
        const userName = (usersMap[post.userId]?.name || '').toLowerCase();
        return (
            post.title.toLowerCase().includes(query) ||
            post.body.toLowerCase().includes(query) ||
            userName.includes(query)
        );
    });

    renderPosts(filtered);
}

// ===== Tətbiqi İşə Salma =====

/**
 * Tətbiqi başladır: postları və istifadəçiləri API-dən gətirir,
 * sonra ekranda göstərir.
 * Bu funksiya səhifə yükləndikdə avtomatik çağırılır.
 */
async function init() {
    showLoader();

    try {
        // Postlar və istifadəçilər eyni vaxtda paralel olaraq yüklənir
        const [posts, users] = await Promise.all([
            PostService.getPosts(),
            PostService.getUsers(),
        ]);

        // İstifadəçiləri ID-yə görə xəritəyə (map) çeviririk ki,
        // sonradan sürətli axtarış edə bilək
        users.forEach((u) => (usersMap[u.id] = u));
        allPosts = posts;

        hideLoader();
        renderPosts(allPosts);
    } catch (err) {
        // Xəta baş verdikdə istifadəçiyə mesaj göstərilir
        showError(`Postları yükləmək mümkün olmadı: ${err.message}`);
    }
}
// ===== Hadisə Dinləyiciləri (Event Listeners) =====

// Axtarış sahəsinə yazıldıqda filtrləmə aparılır
searchInput.addEventListener('input', handleSearch);

// "Yenidən cəhd et" düyməsinə basıldıqda tətbiq yenidən işə salınır
retryBtn.addEventListener('click', init);

// Modal bağlama düyməsinə basıldıqda modal bağlanır
modalClose.addEventListener('click', closeModal);

// Modalın arxa fonuna tıklandıqda modal bağlanır
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Escape düyməsinə basıldıqda modal bağlanır
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Tətbiqi işə sal!
init();



