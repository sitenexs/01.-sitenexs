import { onSnapshot } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

function readCache(storageKey) {
    if (!storageKey) return [];
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function writeCache(storageKey, items) {
    if (!storageKey) return;
    try {
        localStorage.setItem(storageKey, JSON.stringify(items.slice(-200)));
    } catch (e) {}
}

function normalizeForCache(docId, data) {
    const ms = data?.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : (typeof data?.createdAtMs === 'number' ? data.createdAtMs : Date.now());
    return {
        id: docId,
        senderUid: data?.senderUid || '',
        text: data?.text || '',
        isEdited: Boolean(data?.isEdited),
        createdAtMs: ms
    };
}

/**
 * Membersihkan spinner/loader awal tanpa mengosongkan item yang sudah dirender dari cache.
 */
export function prepareFlickerFreeContainer(container, clearExisting = false) {
    if (!container) return;
    const loaders = container.querySelectorAll('.loader-container, #loadingState, [data-loading="true"]');
    loaders.forEach(el => el.remove());
    if (clearExisting) {
        container.innerHTML = '';
    }
}

/**
 * Menyinkronkan snapshot Firestore secara inkremental dengan cache perangkat:
 * - Langsung merender cache perangkat jika ada tanpa loading/render ulang penuh.
 * - Hanya menambah pesan baru, memperbarui pesan yang diedit/berubah, atau menghapus pesan yang dihapus.
 */
export function attachFlickerFreeSnapshot({
    queryRef,
    container,
    keyAttr = 'data-item-id',
    storageKey = null,
    createElement,
    updateElement,
    onAddedItem,
    onModifiedItem,
    onRemovedItem,
    onSnapshotDone,
    onError,
    autoScroll = false,
    scrollThreshold = 120
}) {
    if (!queryRef || !container || typeof createElement !== 'function') {
        return () => {};
    }

    prepareFlickerFreeContainer(container, false);

    const cacheMap = new Map();
    const cachedItems = readCache(storageKey);

    if (cachedItems.length > 0) {
        cachedItems.forEach(item => {
            if (!item || !item.id) return;
            cacheMap.set(item.id, item);
            const existingEl = container.querySelector(`[${keyAttr}="${CSS.escape(item.id)}"]`);
            if (!existingEl) {
                const el = createElement(item.id, item, null);
                if (el) {
                    if (!el.hasAttribute(keyAttr)) {
                        el.setAttribute(keyAttr, item.id);
                    }
                    container.appendChild(el);
                }
            }
        });
        if (autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

    let isInitial = true;

    const unsubscribe = onSnapshot(
        queryRef,
        snapshot => {
            const nearBottom = autoScroll
                ? (container.scrollHeight - container.scrollTop - container.clientHeight) < scrollThreshold
                : false;
            let shouldScroll = false;
            let cacheChanged = false;

            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const docData = change.doc.data();
                const existingEl = container.querySelector(`[${keyAttr}="${CSS.escape(docId)}"]`);

                if (change.type === 'added') {
                    const normalized = normalizeForCache(docId, docData);
                    const prevCached = cacheMap.get(docId);

                    if (!existingEl) {
                        const newEl = createElement(docId, docData, change.doc);
                        if (newEl) {
                            if (!newEl.hasAttribute(keyAttr)) {
                                newEl.setAttribute(keyAttr, docId);
                            }
                            container.appendChild(newEl);
                            if (autoScroll && (isInitial || nearBottom)) {
                                shouldScroll = true;
                            }
                        }
                    } else if (
                        typeof updateElement === 'function' &&
                        prevCached &&
                        (prevCached.text !== normalized.text || prevCached.isEdited !== normalized.isEdited)
                    ) {
                        updateElement(existingEl, docId, docData, change.doc);
                    }

                    cacheMap.set(docId, normalized);
                    cacheChanged = true;

                    if (!isInitial && typeof onAddedItem === 'function') {
                        onAddedItem(docId, docData, change.doc);
                    }
                } else if (change.type === 'modified') {
                    const normalized = normalizeForCache(docId, docData);
                    cacheMap.set(docId, normalized);
                    cacheChanged = true;

                    if (existingEl && typeof updateElement === 'function') {
                        updateElement(existingEl, docId, docData, change.doc);
                    } else if (!existingEl) {
                        const newEl = createElement(docId, docData, change.doc);
                        if (newEl) {
                            if (!newEl.hasAttribute(keyAttr)) {
                                newEl.setAttribute(keyAttr, docId);
                            }
                            container.appendChild(newEl);
                        }
                    }

                    if (typeof onModifiedItem === 'function') {
                        onModifiedItem(docId, docData, change.doc);
                    }
                } else if (change.type === 'removed') {
                    if (existingEl) {
                        existingEl.remove();
                    }
                    if (cacheMap.has(docId)) {
                        cacheMap.delete(docId);
                        cacheChanged = true;
                    }
                    if (typeof onRemovedItem === 'function') {
                        onRemovedItem(docId, docData, change.doc);
                    }
                }
            });

            if (cacheChanged) {
                const sortedCache = Array.from(cacheMap.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
                writeCache(storageKey, sortedCache);
            }

            if (autoScroll && shouldScroll) {
                container.scrollTop = container.scrollHeight;
            }

            if (typeof onSnapshotDone === 'function') {
                onSnapshotDone(snapshot, isInitial);
            }

            isInitial = false;
        },
        error => {
            if (typeof onError === 'function') {
                onError(error);
            } else {
                console.error('Flicker-free snapshot error:', error);
            }
        }
    );

    return () => {
        unsubscribe();
    };
}
