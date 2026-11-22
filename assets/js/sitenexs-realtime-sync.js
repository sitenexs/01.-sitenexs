import { onSnapshot } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

export function readListCache(storageKey) {
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

export function writeListCache(storageKey, items, maxItems = 200) {
    if (!storageKey) return;
    try {
        localStorage.setItem(storageKey, JSON.stringify(items.slice(-maxItems)));
    } catch (e) {}
}

function extractCreatedAtMs(data, fallbackMs = Date.now()) {
    if (data?.createdAt?.toMillis) {
        return data.createdAt.toMillis();
    }
    if (data?.createdAt?.toDate) {
        return data.createdAt.toDate().getTime();
    }
    if (typeof data?.createdAtMs === 'number' && !Number.isNaN(data.createdAtMs)) {
        return data.createdAtMs;
    }
    return fallbackMs;
}

function normalizeForCache(docId, data, existingCached = null) {
    const ms = extractCreatedAtMs(
        data,
        typeof existingCached?.createdAtMs === 'number' ? existingCached.createdAtMs : Date.now()
    );
    return {
        id: docId,
        senderUid: data?.senderUid ?? existingCached?.senderUid ?? '',
        senderName: data?.senderName ?? existingCached?.senderName ?? '',
        senderIsVerified: data?.senderIsVerified !== undefined
            ? Boolean(data.senderIsVerified)
            : Boolean(existingCached?.senderIsVerified),
        senderIsPro: data?.senderIsPro !== undefined
            ? Boolean(data.senderIsPro)
            : Boolean(existingCached?.senderIsPro),
        text: data?.text ?? existingCached?.text ?? '',
        isEdited: data?.isEdited !== undefined
            ? Boolean(data.isEdited)
            : Boolean(existingCached?.isEdited),
        status: data?.status ?? existingCached?.status ?? 'sent',
        checkColor: data?.checkColor ?? existingCached?.checkColor ?? null,
        delivered: data?.delivered !== undefined
            ? Boolean(data.delivered)
            : Boolean(existingCached?.delivered),
        read: data?.read !== undefined
            ? Boolean(data.read)
            : Boolean(existingCached?.read),
        createdAtMs: ms
    };
}

function scrollContainerToBottom(container) {
    if (!container) return;
    const scrollNow = () => {
        container.scrollTop = container.scrollHeight;
    };
    scrollNow();
    requestAnimationFrame(() => {
        scrollNow();
        setTimeout(scrollNow, 50);
    });
}

function insertItemInOrder(container, itemEl, keyAttr, createdAtMs, sortedItemsList) {
    if (!container || !itemEl) return;

    const typingEl = container.querySelector('#typingBubbleWrapper');

    // Cari elemen tetangga setelah posisi item ini berdasarkan urutan waktu
    let nextSiblingEl = null;
    if (Array.isArray(sortedItemsList) && sortedItemsList.length > 0) {
        const myKey = itemEl.getAttribute(keyAttr);
        const myIdx = sortedItemsList.findIndex(x => String(x.id) === String(myKey));
        if (myIdx >= 0) {
            for (let i = myIdx + 1; i < sortedItemsList.length; i++) {
                const candidate = container.querySelector(
                    `[${keyAttr}="${CSS.escape(String(sortedItemsList[i].id))}"]`
                );
                if (candidate && candidate !== itemEl) {
                    nextSiblingEl = candidate;
                    break;
                }
            }
        }
    }

    if (nextSiblingEl) {
        if (itemEl.nextElementSibling !== nextSiblingEl) {
            container.insertBefore(itemEl, nextSiblingEl);
        }
    } else if (typingEl) {
        if (itemEl.nextElementSibling !== typingEl) {
            container.insertBefore(itemEl, typingEl);
        }
    } else if (container.lastElementChild !== itemEl) {
        container.appendChild(itemEl);
    }

    if (typingEl && container.lastElementChild !== typingEl) {
        container.appendChild(typingEl);
    }
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
 * Menyinkronkan array item ke DOM secara inkremental (tambah/ubah/hapus/urutkan)
 * tanpa menghapus tampilan yang sudah ada di layar.
 */
export function reconcileListElements({
    container,
    items,
    getKey,
    keyAttr = 'data-item-id',
    createElement,
    updateElement,
    emptyHtml = ''
}) {
    if (!container) return;

    const emptyStateEl = container.querySelector('[data-empty-state="true"]');

    if (!items || items.length === 0) {
        container.querySelectorAll(`[${keyAttr}]`).forEach(el => el.remove());
        if (!emptyStateEl && emptyHtml) {
            container.innerHTML = emptyHtml;
        }
        return;
    }

    if (emptyStateEl) {
        emptyStateEl.remove();
    }

    const validKeys = new Set(items.map(item => String(getKey(item))));
    container.querySelectorAll(`[${keyAttr}]`).forEach(existingEl => {
        if (!validKeys.has(existingEl.getAttribute(keyAttr))) {
            existingEl.remove();
        }
    });

    items.forEach((item, index) => {
        const key = String(getKey(item));
        let itemEl = container.querySelector(`[${keyAttr}="${CSS.escape(key)}"]`);

        if (!itemEl) {
            itemEl = createElement(item);
            if (itemEl && !itemEl.hasAttribute(keyAttr)) {
                itemEl.setAttribute(keyAttr, key);
            }
        } else if (typeof updateElement === 'function') {
            updateElement(itemEl, item);
        }

        if (itemEl) {
            const currentChildAtIdx = container.children[index];
            if (currentChildAtIdx !== itemEl) {
                container.insertBefore(itemEl, currentChildAtIdx || null);
            }
        }
    });
}

/**
 * Menyinkronkan snapshot Firestore secara inkremental dengan cache perangkat.
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
    scrollThreshold = 180
}) {
    if (!queryRef || !container || typeof createElement !== 'function') {
        return () => {};
    }

    prepareFlickerFreeContainer(container, false);

    const cacheMap = new Map();
    const cachedItems = readListCache(storageKey).slice().sort(
        (a, b) => (a?.createdAtMs || 0) - (b?.createdAtMs || 0)
    );

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
                    insertItemInOrder(container, el, keyAttr, item.createdAtMs || 0, cachedItems);
                }
            }
        });
        if (autoScroll) {
            scrollContainerToBottom(container);
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

            // Bangun daftar urutan lengkap dari snapshot saat ini
            const orderedSnapshotItems = [];
            snapshot.forEach(docSnap => {
                const prev = cacheMap.get(docSnap.id);
                orderedSnapshotItems.push(normalizeForCache(docSnap.id, docSnap.data(), prev));
            });
            orderedSnapshotItems.sort((a, b) => a.createdAtMs - b.createdAtMs);

            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const docData = change.doc.data();
                const existingEl = container.querySelector(`[${keyAttr}="${CSS.escape(docId)}"]`);
                const prevCached = cacheMap.get(docId);

                if (change.type === 'added') {
                    const normalized = normalizeForCache(docId, docData, prevCached);

                    if (!existingEl) {
                        const newEl = createElement(docId, docData, change.doc);
                        if (newEl) {
                            if (!newEl.hasAttribute(keyAttr)) {
                                newEl.setAttribute(keyAttr, docId);
                            }
                            insertItemInOrder(
                                container,
                                newEl,
                                keyAttr,
                                normalized.createdAtMs,
                                orderedSnapshotItems
                            );
                            if (autoScroll && (isInitial || nearBottom || change.doc.metadata?.hasPendingWrites)) {
                                shouldScroll = true;
                            }
                        }
                    } else {
                        if (typeof updateElement === 'function') {
                            updateElement(existingEl, docId, docData, change.doc);
                        }
                        insertItemInOrder(
                            container,
                            existingEl,
                            keyAttr,
                            normalized.createdAtMs,
                            orderedSnapshotItems
                        );
                        if (autoScroll && (isInitial || nearBottom)) {
                            shouldScroll = true;
                        }
                    }

                    cacheMap.set(docId, normalized);
                    cacheChanged = true;

                    if (typeof onAddedItem === 'function') {
                        onAddedItem(docId, docData, change.doc, isInitial);
                    }
                } else if (change.type === 'modified') {
                    const normalized = normalizeForCache(docId, docData, prevCached);
                    cacheMap.set(docId, normalized);
                    cacheChanged = true;

                    if (existingEl && typeof updateElement === 'function') {
                        updateElement(existingEl, docId, docData, change.doc);
                        insertItemInOrder(
                            container,
                            existingEl,
                            keyAttr,
                            normalized.createdAtMs,
                            orderedSnapshotItems
                        );
                    } else if (!existingEl) {
                        const newEl = createElement(docId, docData, change.doc);
                        if (newEl) {
                            if (!newEl.hasAttribute(keyAttr)) {
                                newEl.setAttribute(keyAttr, docId);
                            }
                            insertItemInOrder(
                                container,
                                newEl,
                                keyAttr,
                                normalized.createdAtMs,
                                orderedSnapshotItems
                            );
                        }
                    }

                    if (autoScroll && (nearBottom || change.doc.metadata?.hasPendingWrites)) {
                        shouldScroll = true;
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
                writeListCache(storageKey, sortedCache);
            }

            if (autoScroll && shouldScroll) {
                scrollContainerToBottom(container);
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
