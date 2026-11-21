import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

import {
    supabaseUrl as CONFIG_SUPABASE_URL,
    avatarBucket as CONFIG_AVATAR_BUCKET
} from 'https://sitenexs.com/assets/js/sitenexs-config.js';

const DEFAULT_VERIFIED_BADGE_URL = 'https://sitenexs.com/assets/logo/verified.png';
const DEFAULT_FALLBACK_AVATAR = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff';

const userProfileCache = new Map();

export function getUserAvatarUrl(
    uid,
    {
        supabaseUrl = CONFIG_SUPABASE_URL,
        bucket = CONFIG_AVATAR_BUCKET
    } = {}
) {
    if (!uid) return DEFAULT_FALLBACK_AVATAR;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(uid)}/profile-photo`;
}

export function getUserBadgesHtml(
    profile = {},
    {
        badgeClass = 'chat-header-verif',
        verifiedBadgeUrl = DEFAULT_VERIFIED_BADGE_URL
    } = {}
) {
    const isVerified = typeof profile === 'boolean' ? profile : Boolean(profile?.isVerified);
    if (!isVerified) return '';
    return `<img src="${verifiedBadgeUrl}" class="${badgeClass}" alt="Verified" title="Akun Terverifikasi">`;
}

export function normalizeUserProfile(uid, rawData = {}, options = {}) {
    const firstName = String(rawData.namaDepan || '').trim();
    const lastName = String(rawData.namaBelakang || '').trim();
    const fullName =
        String(rawData.namaLengkap || '').trim() ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        'Mitra Sitenexs';

    const email = String(rawData.email || rawData.bisnis?.email || '').trim();
    const isVerified = Boolean(rawData.isVerified);
    const isFounder = Boolean(rawData.isFounder);
    const avatarUrl = getUserAvatarUrl(uid, options);

    return {
        uid: uid || '',
        displayName: fullName,
        firstName,
        lastName,
        email,
        phone: String(rawData.noTelepon || rawData.bisnis?.telepon || '').trim(),
        bio: String(rawData.bio || '').trim(),
        address: String(rawData.alamat || '').trim(),
        isVerified,
        isFounder,
        badgesHtml: getUserBadgesHtml({ isVerified }, options),
        avatarUrl,
        fcmToken: rawData.fcmToken || null,
        packageName: rawData.paketLangganan || rawData.package || 'basic',
        subscriptionStatus: rawData.statusLangganan || '',
        business: {
            name: rawData.bisnis?.nama || rawData.bisnisNama || '',
            field: rawData.bisnis?.bidang || rawData.bisnisBidang || '',
            email: rawData.bisnis?.email || '',
            phone: rawData.bisnis?.telepon || '',
            logoUrl: rawData.bisnis?.logoUrl || ''
        },
        raw: rawData
    };
}

export async function fetchUserProfile(
    db,
    uid,
    { forceRefresh = false, ...options } = {}
) {
    if (!uid) {
        return normalizeUserProfile('', {}, options);
    }

    if (!forceRefresh && userProfileCache.has(uid)) {
        return userProfileCache.get(uid);
    }

    try {
        const snap = await getDoc(doc(db, 'users', uid));
        const normalized = normalizeUserProfile(
            uid,
            snap.exists() ? snap.data() : {},
            options
        );
        userProfileCache.set(uid, normalized);
        return normalized;
    } catch (error) {
        console.error('Gagal mengambil data user:', error);
        return normalizeUserProfile(uid, {}, options);
    }
}

export function clearUserProfileCache(uid = null) {
    if (uid) {
        userProfileCache.delete(uid);
    } else {
        userProfileCache.clear();
    }
}
