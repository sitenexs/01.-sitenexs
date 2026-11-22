import {
    ref,
    onValue,
    remove
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

export const DEFAULT_CALL_PAGE_URL = 'https://sitenexs.com/community/messages/call/';
export const ONGOING_CALL_STORAGE_KEY = 'sitenexs_ongoing_call_room';

export function saveOngoingCallRoom(info) {
    try {
        if (!info || !info.roomId) {
            sessionStorage.removeItem(ONGOING_CALL_STORAGE_KEY);
            return;
        }
        sessionStorage.setItem(ONGOING_CALL_STORAGE_KEY, JSON.stringify({
            roomId: info.roomId,
            peerUid: info.peerUid || '',
            peerName: info.peerName || 'Mitra Sitenexs',
            callType: info.callType === 'audio' ? 'audio' : 'video',
            mode: info.mode || 'outgoing',
            savedAt: Date.now()
        }));
    } catch (e) {}
}

export function readOngoingCallRoom() {
    try {
        const raw = sessionStorage.getItem(ONGOING_CALL_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.roomId || (Date.now() - (parsed.savedAt || 0) > 600000)) {
            sessionStorage.removeItem(ONGOING_CALL_STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

export function buildResumeCallUrl(info, callPageUrl = DEFAULT_CALL_PAGE_URL) {
    const callUrl = new URL(callPageUrl);
    if (info?.roomId) callUrl.searchParams.set('roomId', info.roomId);
    if (info?.peerUid) callUrl.searchParams.set('to', info.peerUid);
    callUrl.searchParams.set('mode', info?.mode || 'outgoing');
    callUrl.searchParams.set('type', info?.callType === 'audio' ? 'audio' : 'video');
    callUrl.searchParams.set('resume', '1');
    return callUrl.toString();
}

/**
 * 1. LOGIKA TERPISAH: Saat ada panggilan masuk, paksa buka halaman panggilan masuk.
 */
export function attachForcedIncomingCallRedirect({
    rtdb,
    currentUid,
    callPageUrl = DEFAULT_CALL_PAGE_URL,
    fallbackPeerName = 'Mitra Sitenexs'
}) {
    if (!rtdb || !currentUid) return () => {};

    let isRedirecting = false;
    const incomingRef = ref(rtdb, `incomingCalls/${currentUid}`);

    const unsubscribe = onValue(incomingRef, snapshot => {
        const data = snapshot.val();
        if (!data) return;

        if (data.timestamp && Date.now() - data.timestamp > 60000) {
            remove(incomingRef).catch(() => {});
            return;
        }

        if (data.callerUid === currentUid) return;

        if (
            data.calleeUid === currentUid &&
            data.status === 'ringing' &&
            !isRedirecting
        ) {
            isRedirecting = true;
            if (data.roomId) {
                saveOngoingCallRoom({
                    roomId: data.roomId,
                    peerUid: data.callerUid,
                    peerName: data.callerName || fallbackPeerName,
                    callType: data.callType === 'audio' ? 'audio' : 'video',
                    mode: 'incoming'
                });
            }

            const callUrl = new URL(callPageUrl);
            callUrl.searchParams.set('to', data.callerUid);
            callUrl.searchParams.set('mode', 'incoming');
            callUrl.searchParams.set('roomId', data.roomId);
            callUrl.searchParams.set('type', data.callType === 'audio' ? 'audio' : 'video');
            window.location.replace(callUrl.toString());
        }
    }, error => {
        console.error('Forced incoming call redirect error:', error);
    });

    return () => {
        unsubscribe();
    };
}

function isUserActivelyInCallRoom(roomData, currentUid) {
    if (!roomData || typeof roomData !== 'object' || !currentUid) return false;
    if (roomData.status === 'ended' || roomData.status === 'rejected') return false;
    if (roomData.status !== 'ringing' && roomData.status !== 'connected') return false;

    const myParticipant = roomData.participants && roomData.participants[currentUid];
    if (!myParticipant || typeof myParticipant !== 'object') return false;

    const joinedAt = myParticipant.joinedAt || 0;
    if (!joinedAt || (Date.now() - joinedAt > 600000)) return false;

    return true;
}

/**
 * 2. LOGIKA TERPISAH: Saat panggilan sedang berlangsung, tampilkan banner "Dalam panggilan..."
 *    di bawah navbar dan lanjutkan ke panggilan saat ditekan.
 */
export function attachOngoingCallBanner({
    rtdb,
    currentUid,
    bannerElement,
    textElement,
    iconElement,
    filterPeerUid = null,
    filterChatId = null,
    fallbackPeerName = 'Mitra Sitenexs',
    callPageUrl = DEFAULT_CALL_PAGE_URL
}) {
    if (!rtdb || !currentUid || !bannerElement) return () => {};

    let currentTarget = null;
    let isNavigating = false;

    function hideBanner() {
        currentTarget = null;
        saveOngoingCallRoom(null);
        bannerElement.classList.remove('active');
    }

    function showBanner(info) {
        currentTarget = info;
        saveOngoingCallRoom(info);

        if (iconElement) {
            iconElement.className = info.callType === 'audio'
                ? 'fas fa-phone-alt'
                : 'fas fa-video';
        }
        if (textElement) {
            textElement.textContent = 'Dalam panggilan...';
        }
        bannerElement.classList.add('active');
    }

    const handleClick = () => {
        const target = currentTarget || readOngoingCallRoom();
        if (!target || !target.roomId || isNavigating) return;
        isNavigating = true;
        window.location.href = buildResumeCallUrl(target, callPageUrl);
    };

    bannerElement.addEventListener('click', handleClick);
    hideBanner();

    const callsRootRef = ref(rtdb, 'calls');
    const unsubscribe = onValue(callsRootRef, snapshot => {
        const allCalls = snapshot.val() || {};
        let foundRoom = null;

        for (const [roomKey, roomData] of Object.entries(allCalls)) {
            if (!isUserActivelyInCallRoom(roomData, currentUid)) continue;

            const matchesPeerOrChat =
                (!filterPeerUid && !filterChatId) ||
                (filterPeerUid && (
                    roomData.callerUid === filterPeerUid ||
                    roomData.calleeUid === filterPeerUid ||
                    Boolean(roomData.participants && roomData.participants[filterPeerUid])
                )) ||
                (filterChatId && roomData.chatId === filterChatId);

            if (matchesPeerOrChat) {
                foundRoom = {
                    roomId: roomData.roomId || roomKey,
                    peerUid: roomData.callerUid === currentUid
                        ? (roomData.calleeUid || filterPeerUid || '')
                        : (roomData.callerUid || filterPeerUid || ''),
                    peerName: roomData.callerUid === currentUid
                        ? fallbackPeerName
                        : (roomData.callerName || fallbackPeerName),
                    callType: roomData.callType === 'audio' ? 'audio' : 'video',
                    mode: roomData.callerUid === currentUid ? 'outgoing' : 'incoming'
                };
                break;
            }
        }

        if (foundRoom) {
            showBanner(foundRoom);
        } else {
            hideBanner();
        }
    }, () => {
        hideBanner();
    });

    return () => {
        bannerElement.removeEventListener('click', handleClick);
        unsubscribe();
    };
}
