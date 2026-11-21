importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyDuN4zlRaSnmcUSuXE_E_E',
    authDomain: 'sitenexs-62919.firebaseapp.com',
    databaseURL: 'https://sitenexs-62919-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'sitenexs-62919',
    storageBucket: 'sitenexs-62919.firebasestorage.app',
    messagingSenderId: '1060348110644',
    appId: '1:1060348110644:web:e45af14d5f26a9cf8e6761'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Sitenexs';
    const options = {
        body: payload.notification?.body || payload.data?.body || 'Anda memiliki pesan atau panggilan masuk.',
        icon: payload.notification?.icon || 'https://sitenexs.com/assets/logo/logo.png',
        badge: 'https://sitenexs.com/assets/logo/logo.png',
        tag: payload.data?.tag || 'sitenexs-bg-notif',
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 150, 300],
        data: {
            url: payload.data?.url || 'https://sitenexs.com/community/messages/'
        }
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || 'https://sitenexs.com/community/messages/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes('sitenexs.com') && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
