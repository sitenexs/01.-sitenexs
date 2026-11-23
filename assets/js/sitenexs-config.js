import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

export const firebaseConfig = {
    apiKey: 'AIzaSyDuN4zlRaSnmcUSuXE_E84IE7d3Mz8E-N4',
    authDomain: 'sitenexs-62919.firebaseapp.com',
    databaseURL: 'https://sitenexs-62919-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'sitenexs-62919',
    storageBucket: 'sitenexs-62919.firebasestorage.app',
    messagingSenderId: '1060348110644',
    appId: '1:1060348110644:web:e45af14d5f26a9cf8e6761'
};

export const FCM_VAPID_KEY = 'BLJA0jutfD7HaJA0E36vDSW8fKy2k0xv1KIgSdxH_luJ-Y8tRp6GvXifKzdWJ_V3vNXkBhe3bbNYmrXd_sCJLhY';
export const PUSH_WORKER_URL = 'https://sitenexs-push.sitenexs.workers.dev';

export const supabaseConfig = {
    url: 'https://xqcbyamxiekdxytntlno.supabase.co',
    publishableKey: 'sb_publishable_XKHXYrEw2EDdfYH17Uyx6w_k_BtGLQa',
    avatarBucket: 'profile-photos'
};

export const supabaseUrl = supabaseConfig.url;
export const supabasePublishableKey = supabaseConfig.publishableKey;
export const avatarBucket = supabaseConfig.avatarBucket;

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);
