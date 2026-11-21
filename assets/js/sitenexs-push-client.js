import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

import {
    getMessaging,
    getToken,
    onMessage,
    isSupported
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging.js';

const DEFAULT_PUSH_WORKER_URL = 'https://sitenexs-push.sitenexs.workers.dev';
const DEFAULT_VAPID_KEY = 'BLJA0jutfD7HaJA0E36vDSW8fKy2k0xv1KIgSdxH_luJ-Y8tRp6GvXifKzdWJ_V3vNXkBhe3bbNYmrXd_sCJLhY';
const DEFAULT_ICON = 'https://sitenexs.com/assets/logo/logo.png';

let swRegistration = null;
let lastPushSentAt = 0;
const sentPushTags = new Set();

export async function registerPushServiceWorker(swPath = '/firebase-messaging-sw.js') {
    if (!('serviceWorker' in navigator)) return null;
    try {
        swRegistration = await navigator.serviceWorker.register(swPath);
        return swRegistration;
    } catch (e) {
        console.warn('Service Worker FCM belum terdaftar:', e.message);
        return null;
    }
}

export async function syncFcmToken({
    app,
    db,
    uid,
    vapidKey = DEFAULT_VAPID_KEY,
    swPath = '/firebase-messaging-sw.js',
    onTokenSaved = null,
    onError = null
}) {
    if (!uid) {
        if (onError) onError(new Error('UID user kosong.'));
        return null;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        if (onError) onError(new Error('Izin notifikasi belum granted.'));
        return null;
    }

    try {
        const supported = await isSupported();
        if (!supported) {
            if (onError) onError(new Error('Browser HP ini tidak mendukung FCM.'));
            return null;
        }

        const reg = await navigator.serviceWorker.register(swPath);
        swRegistration = reg;
        await navigator.serviceWorker.ready;

        const messaging = getMessaging(app);
        const fcmToken = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: reg
        });

        if (fcmToken) {
            await setDoc(doc(db, 'users', uid), {
                fcmToken,
                fcmUpdatedAt: serverTimestamp()
            }, { merge: true });

            if (onTokenSaved) onTokenSaved(fcmToken);
            return fcmToken;
        }

        if (onError) onError(new Error('FCM Token kosong dari server Firebase.'));
        return null;
    } catch (error) {
        if (onError) onError(error);
        return null;
    }
}

export function listenForegroundMessages(app, onForegroundNotify = null) {
    isSupported().then((supported) => {
        if (!supported) return;
        try {
            const messaging = getMessaging(app);
            onMessage(messaging, (payload) => {
                const title = payload?.notification?.title || payload?.data?.title || 'Sitenexs';
                const body = payload?.notification?.body || payload?.data?.body || '';
                const tag = payload?.data?.tag || 'sitenexs-fcm';
                const icon = payload?.data?.icon || DEFAULT_ICON;
                const url = payload?.data?.url || window.location.href;

                if (onForegroundNotify) {
                    onForegroundNotify({ title, body, tag, icon, url, payload });
                }
            });
        } catch (e) {}
    }).catch(() => {});
}

export async function triggerLocalSystemNotification(title, body, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifOptions = {
        body: body || '',
        icon: options.icon || DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: options.tag || 'sitenexs-notif',
        renotify: true,
        silent: false,
        requireInteraction: Boolean(options.requireInteraction),
        vibrate: options.vibrate || [200, 100, 200],
        data: { url: options.url || window.location.href }
    };

    try {
        const reg = swRegistration || (await navigator.serviceWorker?.getRegistration());
        if (reg && reg.showNotification) {
            await reg.showNotification(title, notifOptions);
            return;
        }
    } catch (e) {}

    try {
        const notif = new Notification(title, notifOptions);
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
    } catch (e) {}
}

export async function sendPushNotification({
    db,
    recipientUid,
    cachedToken = null,
    title,
    body,
    tag = 'sitenexs-notif',
    url = 'https://sitenexs.com/community/messages/',
    icon = DEFAULT_ICON,
    workerUrl = DEFAULT_PUSH_WORKER_URL,
    cooldownMs = 5000
}) {
    try {
        if (!workerUrl || !recipientUid) return { sent: false, token: cachedToken };

        const now = Date.now();
        if (tag && tag.startsWith('call-')) {
            if (sentPushTags.has(tag)) return { sent: false, token: cachedToken };
            sentPushTags.add(tag);
        } else if (now - lastPushSentAt < cooldownMs) {
            return { sent: false, token: cachedToken };
        }
        lastPushSentAt = now;

        let targetToken = cachedToken;
        if (!targetToken && db) {
            const snap = await getDoc(doc(db, 'users', recipientUid));
            if (snap.exists()) {
                targetToken = snap.data().fcmToken || null;
            }
        }
        if (!targetToken) return { sent: false, token: null };

        await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: targetToken,
                title,
                body,
                tag,
                url,
                icon
            })
        });

        return { sent: true, token: targetToken };
    } catch (e) {
        console.warn('Push notification gagal dikirim:', e.message);
        return { sent: false, token: cachedToken };
    }
}
