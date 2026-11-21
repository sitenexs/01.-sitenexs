import {
    doc,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

import {
    db
} from 'https://sitenexs.com/assets/js/sitenexs-config.js';

import {
    fetchUserProfile,
    getUserAvatarUrl
} from 'https://sitenexs.com/assets/js/sitenexs-user-data.js';

let navbarState = {
    uid: null,
    notifications: [],
    unsubNotifs: null,
    unsubMsgs: null,
    onSelectNotif: null
};

function formatRelTime(ms) {
    if (!ms) return 'Baru saja';
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec >= 31536000) return Math.floor(sec / 31536000) + 'th lalu';
    if (sec >= 2592000) return Math.floor(sec / 2592000) + 'bln lalu';
    if (sec >= 86400) return Math.floor(sec / 86400) + 'hr lalu';
    if (sec >= 3600) return Math.floor(sec / 3600) + 'j lalu';
    if (sec >= 60) return Math.floor(sec / 60) + 'm lalu';
    return 'Baru saja';
}

function getNavbarStyles() {
    return `
        <style id="sitenexsNavbarStyles">
            #navbar {
                position: sticky; top: 0; z-index: 1000;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid var(--border-subtle, #e2e8f0);
                box-shadow: var(--shadow-sm, 0 1px 3px rgba(15, 23, 42, 0.05));
            }
            .nav-container {
                display: flex; align-items: center; justify-content: space-between;
                height: 65px; width: 100%; max-width: 680px;
                margin: 0 auto; padding: 0 1rem;
            }
            .logo {
                display: flex; align-items: center; gap: 0.5rem;
                font-weight: 800; font-size: 1.1rem;
                color: var(--text-main, #0f172a);
            }
            .logo img {
                height: 32px; width: 32px; border-radius: 50%; object-fit: cover;
                border: 2px solid #fff; box-shadow: var(--shadow-sm, 0 1px 3px rgba(15, 23, 42, 0.05));
            }
            .logo-text {
                background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #10b981 100%);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                text-transform: uppercase; font-weight: 800; letter-spacing: -0.02em;
            }
            .nav-actions { display: flex; gap: 0.45rem; align-items: center; }

            .sitenexs-nav-btn {
                position: relative; width: 38px; height: 38px; padding: 0;
                border-radius: 50%; background: #fff;
                border: 1px solid var(--border-medium, #cbd5e1);
                color: var(--text-main, #0f172a);
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 0.95rem; cursor: pointer;
                transition: all 0.25s ease;
                box-shadow: var(--shadow-sm, 0 1px 3px rgba(15, 23, 42, 0.05));
            }
            .sitenexs-nav-btn:hover {
                border-color: var(--primary, #2563eb);
                color: var(--primary, #2563eb);
            }

            .icon-count-badge {
                position: absolute; top: -4px; right: -4px;
                background: #ef4444; color: #fff;
                font-size: 0.62rem; font-weight: 800; line-height: 1;
                min-width: 17px; height: 17px; padding: 0 0.28rem;
                border-radius: 9999px; border: 2px solid #fff;
                display: none; align-items: center; justify-content: center;
                box-shadow: 0 2px 5px rgba(239, 68, 68, 0.35);
                z-index: 5;
            }
            .icon-count-badge.active { display: inline-flex; }

            .notif-panel-wrapper { position: relative; }
            .notif-dropdown-panel {
                position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
                width: calc(100% - 2rem); max-width: 390px;
                background: #fff; border: 1px solid var(--border-medium, #cbd5e1);
                border-radius: 1rem;
                box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.12);
                z-index: 2500; display: none; flex-direction: column; overflow: hidden;
            }
            .notif-dropdown-panel.active { display: flex; }
            .notif-panel-header {
                padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-subtle, #e2e8f0);
                display: flex; align-items: center; justify-content: space-between;
                background: #fff; font-size: 0.85rem; font-weight: 800;
                color: var(--text-main, #0f172a);
            }
            .notif-mark-read-btn {
                background: var(--primary-light, #eff6ff);
                color: var(--primary, #2563eb);
                font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.6rem;
                border-radius: 9999px; cursor: pointer; border: none;
            }
            .notif-panel-list {
                max-height: 320px; overflow-y: auto; display: flex; flex-direction: column;
            }
            .notif-entry {
                display: flex; align-items: flex-start; gap: 0.65rem;
                padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9;
                cursor: pointer; transition: background 0.2s ease; text-align: left;
                background: #fff; border-left: none; border-right: none; border-top: none;
                width: 100%;
            }
            .notif-entry:hover { background: #f8fafc; }
            .notif-entry.unread { background: var(--primary-light, #eff6ff); }
            .notif-entry-icon {
                width: 32px; height: 32px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.85rem; flex-shrink: 0; margin-top: 2px;
            }
            .notif-entry-icon.post { background: #dbeafe; color: #2563eb; }
            .notif-entry-icon.like { background: #fee2e2; color: #ef4444; }
            .notif-entry-icon.comment { background: #d1fae5; color: #059669; }
            .notif-entry-icon.mention { background: #fef3c7; color: #d97706; }
            .notif-entry-body { flex: 1; min-width: 0; }
            .notif-entry-title { font-size: 0.78rem; font-weight: 700; color: var(--text-main, #0f172a); line-height: 1.35; }
            .notif-entry-sub { font-size: 0.72rem; color: var(--text-muted, #475569); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .notif-entry-time { font-size: 0.62rem; color: var(--text-muted, #475569); margin-top: 3px; }
            .notif-empty-state {
                padding: 2.25rem 1rem; text-align: center;
                color: var(--text-muted, #475569); font-size: 0.8rem;
            }

            .profile-burger-combo {
                display: inline-flex; align-items: center; gap: 0.45rem;
                padding: 0.2rem 0.6rem 0.2rem 0.2rem;
                border-radius: 9999px;
                background: #fff; border: 1px solid var(--border-medium, #cbd5e1);
                box-shadow: var(--shadow-sm, 0 1px 3px rgba(15, 23, 42, 0.05));
                cursor: pointer; transition: all 0.25s ease;
                color: var(--text-main, #0f172a); flex-shrink: 0;
            }
            .profile-burger-combo:hover {
                border-color: var(--primary, #2563eb);
                background: var(--primary-light, #eff6ff);
                color: var(--primary, #2563eb);
            }
            .nav-profile-link {
                width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
                border: 1px solid var(--border-medium, #cbd5e1);
                display: inline-flex; align-items: center; justify-content: center;
                background: #fff; position: relative; flex-shrink: 0;
            }
            .nav-profile-img { width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 2; }
            .nav-profile-initials {
                width: 100%; height: 100%; background: #cbd5e1;
                color: var(--text-muted, #475569);
                font-size: 0.7rem; font-weight: 800;
                display: flex; align-items: center; justify-content: center;
                position: absolute; top: 0; left: 0; z-index: 1;
            }
            .burger-bars-icon {
                font-size: 0.85rem; color: var(--text-main, #0f172a);
                display: inline-flex; align-items: center; justify-content: center;
            }

            .sidebar-backdrop {
                position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
                backdrop-filter: blur(2px); z-index: 4000; display: none;
            }
            .sidebar-backdrop.active { display: block; }
            .nav-sidebar-drawer {
                position: fixed; top: 0; right: -300px; width: 280px; max-width: 85vw; height: 100%;
                background: #fff; z-index: 4001;
                box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.15);
                border-left: 1px solid var(--border-subtle, #e2e8f0);
                display: flex; flex-direction: column;
                transition: right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
                padding: 1.15rem;
            }
            .nav-sidebar-drawer.active { right: 0; }
            .sidebar-top-row {
                display: flex; align-items: center; justify-content: space-between;
                padding-bottom: 0.9rem; border-bottom: 1px solid var(--border-subtle, #e2e8f0);
                margin-bottom: 0.85rem;
            }
            .sidebar-user-summary { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
            .sidebar-user-avatar {
                width: 42px; height: 42px; border-radius: 50%; object-fit: cover;
                border: 1px solid var(--border-medium, #cbd5e1); flex-shrink: 0;
            }
            .sidebar-user-name {
                font-size: 0.88rem; font-weight: 800; color: var(--text-main, #0f172a);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .sidebar-user-sub { font-size: 0.7rem; color: var(--text-muted, #475569); font-weight: 600; }
            .sidebar-close-btn {
                background: var(--bg-body, #f8fafc); width: 28px; height: 28px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.85rem; color: var(--text-muted, #475569); cursor: pointer; border: none;
            }
            .sidebar-menu-list { display: flex; flex-direction: column; gap: 0.35rem; }
            .sidebar-menu-link {
                display: flex; align-items: center; gap: 0.7rem;
                padding: 0.7rem 0.85rem; border-radius: 0.625rem;
                font-size: 0.84rem; font-weight: 700; color: var(--text-main, #0f172a);
                transition: all 0.2s ease;
            }
            .sidebar-menu-link:hover {
                background: var(--primary-light, #eff6ff);
                color: var(--primary, #2563eb);
            }
            .sidebar-menu-link i { width: 18px; text-align: center; color: var(--primary, #2563eb); }
        </style>
    `;
}

function isCommunityRoute() {
    const pathname = window.location.pathname || '';
    const href = window.location.href || '';
    return pathname === '/community' ||
           pathname.startsWith('/community/') ||
           href.includes('sitenexs.com/community');
}

function renderNotifsList() {
    const badgeEl = document.getElementById('communityNotifBadge');
    const listEl = document.getElementById('communityNotifList');

    const unreadCount = navbarState.notifications.filter(n => n.unread).length;
    if (badgeEl) {
        badgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badgeEl.classList.toggle('active', unreadCount > 0);
    }

    if (!listEl) return;
    if (navbarState.notifications.length === 0) {
        listEl.innerHTML = '<div class="notif-empty-state">Belum ada notifikasi postingan, komentar, penyebutan, atau suka baru.</div>';
        return;
    }

    listEl.innerHTML = navbarState.notifications.map(n => {
        let iconClass = 'fas fa-newspaper';
        let iconKind = 'post';
        if (n.kind === 'like') {
            iconClass = 'fas fa-thumbs-up';
            iconKind = 'like';
        } else if (n.kind === 'comment') {
            iconClass = 'fas fa-comment-alt';
            iconKind = 'comment';
        } else if (n.kind === 'mention') {
            iconClass = 'fas fa-at';
            iconKind = 'mention';
        }

        return `
            <button type="button" class="notif-entry ${n.unread ? 'unread' : ''}" data-notif-id="${n.id}" data-post-id="${n.postId || ''}" data-focus-comments="${n.focusComments ? '1' : '0'}">
                <div class="notif-entry-icon ${iconKind}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notif-entry-body">
                    <div class="notif-entry-title">${n.title}</div>
                    ${n.sub ? `<div class="notif-entry-sub">${n.sub}</div>` : ''}
                    <div class="notif-entry-time">${formatRelTime(n.createdAt)}</div>
                </div>
            </button>
        `;
    }).join('');

    listEl.querySelectorAll('.notif-entry').forEach(btn => {
        btn.addEventListener('click', async () => {
            const notifId = btn.getAttribute('data-notif-id');
            const postId = btn.getAttribute('data-post-id') || '';
            const focusComments = btn.getAttribute('data-focus-comments') === '1';

            navbarState.notifications = navbarState.notifications.map(item =>
                item.id === notifId ? { ...item, unread: false } : item
            );
            renderNotifsList();

            if (navbarState.uid && notifId) {
                setDoc(doc(db, 'users', navbarState.uid, 'notifications', notifId), { unread: false }, { merge: true }).catch(() => {});
            }

            const panel = document.getElementById('communityNotifPanel');
            if (panel) panel.classList.remove('active');

            if (typeof navbarState.onSelectNotif === 'function') {
                navbarState.onSelectNotif({ notifId, postId, focusComments });
            } else if (postId) {
                window.location.href = `https://sitenexs.com/community/?post=${encodeURIComponent(postId)}`;
            }
        });
    });
}

function updateMsgBadge(count) {
    const badgeEl = document.getElementById('msgUnreadCountBadge');
    if (!badgeEl) return;
    if (count > 0) {
        badgeEl.textContent = count > 99 ? '99+' : String(count);
        badgeEl.classList.add('active');
    } else {
        badgeEl.textContent = '0';
        badgeEl.classList.remove('active');
    }
}

function subscribeUserNavbarRealtime(uid) {
    if (!uid) return;
    navbarState.uid = uid;

    if (navbarState.unsubNotifs) navbarState.unsubNotifs();
    if (navbarState.unsubMsgs) navbarState.unsubMsgs();

    const qNotifs = query(
        collection(db, 'users', uid, 'notifications'),
        orderBy('createdAt', 'desc')
    );

    navbarState.unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
        const list = [];
        snapshot.forEach(dSnap => {
            const d = dSnap.data();
            list.push({
                id: dSnap.id,
                kind: d.kind || 'post',
                title: d.title || 'Notifikasi Komunitas',
                sub: d.sub || '',
                postId: d.postId || '',
                focusComments: Boolean(d.focusComments),
                unread: d.unread !== false,
                createdAt: Number(d.createdAt || Date.now())
            });
        });
        navbarState.notifications = list.slice(0, 60);
        renderNotifsList();
    });

    const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
    navbarState.unsubMsgs = onSnapshot(qChats, (snapshot) => {
        let unreadChats = 0;
        snapshot.forEach(docSnap => {
            const chatData = docSnap.data();
            if (chatData[`unread_${uid}`] === true && chatData[`archived_${uid}`] !== true) {
                unreadChats += 1;
            }
        });
        updateMsgBadge(unreadChats);
    });
}

export async function mountSitenexsNavbar({
    targetSelector = '#navbar',
    uid = null,
    onSelectNotif = null
} = {}) {
    if (!document.getElementById('sitenexsNavbarStyles')) {
        document.head.insertAdjacentHTML('beforeend', getNavbarStyles());
    }

    const hostEl = document.querySelector(targetSelector);
    if (!hostEl) return;

    navbarState.onSelectNotif = onSelectNotif;

    const inCommunity = isCommunityRoute();
    // Saat di halaman komunitas: tombol tetap ikon rumah (ke beranda).
    // Saat di halaman lain: tombol berubah menjadi tombol komunitas (ke /community/).
    const homeOrCommHref = inCommunity ? 'https://sitenexs.com/' : 'https://sitenexs.com/community/';
    const homeOrCommTitle = inCommunity ? 'Beranda' : 'Komunitas';
    const homeOrCommIcon = inCommunity ? 'fas fa-home' : 'fas fa-users';

    hostEl.innerHTML = `
        <div class="nav-container">
            <a href="https://sitenexs.com/" class="logo">
                <img src="https://sitenexs.com/assets/logo/logo.png" alt="Sitenexs Logo" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=Sitenexs&background=2563eb&color=fff'">
                <span class="logo-text" id="navLogoText">SiteNexs</span>
            </a>
            <div class="nav-actions">
                <a href="https://sitenexs.com/community/messages/" class="sitenexs-nav-btn" title="Pesan">
                    <i class="fas fa-comments"></i>
                    <span class="icon-count-badge" id="msgUnreadCountBadge">0</span>
                </a>

                <div class="notif-panel-wrapper">
                    <button type="button" id="communityNotifBtn" class="sitenexs-nav-btn" title="Notifikasi">
                        <i class="fas fa-bell"></i>
                        <span class="icon-count-badge" id="communityNotifBadge">0</span>
                    </button>
                    <div class="notif-dropdown-panel" id="communityNotifPanel">
                        <div class="notif-panel-header">
                            <span>Notifikasi</span>
                            <button type="button" class="notif-mark-read-btn" id="notifMarkAllReadBtn">Tandai dibaca</button>
                        </div>
                        <div class="notif-panel-list" id="communityNotifList">
                            <div class="notif-empty-state">Belum ada notifikasi postingan, komentar, penyebutan, atau suka baru.</div>
                        </div>
                    </div>
                </div>

                <a href="${homeOrCommHref}" id="navHomeOrCommunityBtn" class="sitenexs-nav-btn" title="${homeOrCommTitle}">
                    <i class="${homeOrCommIcon}"></i>
                </a>

                <button type="button" id="profileBurgerBtn" class="profile-burger-combo" title="Menu Profil & Navigasi">
                    <span id="navProfileLink" class="nav-profile-link">
                        <img id="navProfileImg" src="" alt="Profil" class="nav-profile-img">
                        <div id="navProfileInitials" class="nav-profile-initials"><i class="fas fa-user"></i></div>
                    </span>
                    <span class="burger-bars-icon"><i class="fas fa-bars"></i></span>
                </button>
            </div>
        </div>
    `;

    if (!document.getElementById('sitenexsSidebarDrawer')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="sidebar-backdrop" id="sitenexsSidebarBackdrop"></div>
            <aside class="nav-sidebar-drawer" id="sitenexsSidebarDrawer">
                <div class="sidebar-top-row">
                    <div class="sidebar-user-summary">
                        <img id="sidebarUserAvatar" src="https://ui-avatars.com/api/?name=User&background=2563eb&color=fff" alt="Profil" class="sidebar-user-avatar">
                        <div style="min-width: 0;">
                            <div class="sidebar-user-name" id="sidebarUserName">Mitra Sitenexs</div>
                            <div class="sidebar-user-sub" id="sidebarUserPackage">Paket Basic</div>
                        </div>
                    </div>
                    <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" title="Tutup Menu">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <nav class="sidebar-menu-list">
                    <a href="https://account.sitenexs.com/profile" id="sidebarProfileLink" class="sidebar-menu-link">
                        <i class="fas fa-user-circle"></i> <span>Profil Saya</span>
                    </a>
                    <a href="https://sitenexs.com/community/messages/" class="sidebar-menu-link">
                        <i class="fas fa-comments"></i> <span>Pesan Masuk</span>
                    </a>
                    <a href="https://sitenexs.com/community/" class="sidebar-menu-link">
                        <i class="fas fa-users"></i> <span>Komunitas</span>
                    </a>
                    <a href="https://sitenexs.com/" class="sidebar-menu-link">
                        <i class="fas fa-home"></i> <span>Beranda Sitenexs</span>
                    </a>
                </nav>
            </aside>
        `);
    }

    const setDrawerOpen = (open) => {
        const drawer = document.getElementById('sitenexsSidebarDrawer');
        const backdrop = document.getElementById('sitenexsSidebarBackdrop');
        if (drawer) drawer.classList.toggle('active', open);
        if (backdrop) backdrop.classList.toggle('active', open);
    };

    document.getElementById('profileBurgerBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const drawer = document.getElementById('sitenexsSidebarDrawer');
        setDrawerOpen(!drawer?.classList.contains('active'));
    });

    document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => setDrawerOpen(false));
    document.getElementById('sitenexsSidebarBackdrop')?.addEventListener('click', () => setDrawerOpen(false));

    document.getElementById('communityNotifBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = document.getElementById('communityNotifPanel');
        if (panel) panel.classList.toggle('active');
    });

    document.getElementById('notifMarkAllReadBtn')?.addEventListener('click', async () => {
        navbarState.notifications = navbarState.notifications.map(n => ({ ...n, unread: false }));
        renderNotifsList();
        if (navbarState.uid) {
            try {
                await Promise.all(
                    navbarState.notifications.map(n =>
                        setDoc(doc(db, 'users', navbarState.uid, 'notifications', n.id), { unread: false }, { merge: true })
                    )
                );
            } catch (e) {}
        }
    });

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('communityNotifPanel');
        if (panel && panel.classList.contains('active') && !e.target.closest('.notif-panel-wrapper')) {
            panel.classList.remove('active');
        }
    });

    const activeUid = uid || localStorage.getItem('sitenexs_uid');
    if (activeUid) {
        await setNavbarUserProfile(activeUid);
    }
}

export async function setNavbarUserProfile(uid) {
    if (!uid) return;
    navbarState.uid = uid;
    subscribeUserNavbarRealtime(uid);

    try {
        const profile = await fetchUserProfile(db, uid, { forceRefresh: true });
        const namaLengkap = profile.displayName || 'Mitra Sitenexs';
        const pkgName = profile.packageName || 'Basic';
        const cleanPkg = String(pkgName).replace(/^(paket\s*)+/i, '').trim().toLowerCase();

        let themePkg = 'basic';
        if (cleanPkg.includes('pro')) themePkg = 'pro';
        else if (cleanPkg.includes('vip') || cleanPkg.includes('ultimate') || cleanPkg.includes('premium')) themePkg = 'vip';

        document.body.setAttribute('data-package', themePkg);

        const logoTextEl = document.getElementById('navLogoText');
        if (logoTextEl) {
            logoTextEl.innerText = (themePkg === 'basic' || !pkgName || cleanPkg === 'basic')
                ? 'SiteNexs'
                : String(pkgName).toUpperCase();
        }

        const photoUrl = `${getUserAvatarUrl(uid)}?t=${Date.now()}`;
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(namaLengkap)}&background=2563eb&color=fff`;
        const initials = namaLengkap.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'S';

        const navImg = document.getElementById('navProfileImg');
        const navInit = document.getElementById('navProfileInitials');
        if (navImg && navInit) {
            navImg.onload = () => {
                navImg.style.display = 'block';
                navInit.style.display = 'none';
            };
            navImg.onerror = () => {
                navImg.style.display = 'none';
                navInit.innerHTML = `<span style="font-size: 0.7rem; font-weight:800; color:#475569;">${initials}</span>`;
                navInit.style.display = 'flex';
            };
            navImg.src = photoUrl;
        }

        const sidebarNameEl = document.getElementById('sidebarUserName');
        const sidebarPkgEl = document.getElementById('sidebarUserPackage');
        const sidebarAvatarEl = document.getElementById('sidebarUserAvatar');
        const sidebarProfileLink = document.getElementById('sidebarProfileLink');

        if (sidebarNameEl) sidebarNameEl.innerText = namaLengkap;
        if (sidebarPkgEl) sidebarPkgEl.innerText = `Paket ${pkgName}`;
        if (sidebarAvatarEl) {
            sidebarAvatarEl.src = photoUrl;
            sidebarAvatarEl.onerror = () => { sidebarAvatarEl.src = fallbackUrl; };
        }
        if (sidebarProfileLink) {
            sidebarProfileLink.href = `https://account.sitenexs.com/profile?uid=${encodeURIComponent(uid)}`;
        }
    } catch (e) {
        console.warn('Gagal memuat profil navbar:', e);
    }
}
