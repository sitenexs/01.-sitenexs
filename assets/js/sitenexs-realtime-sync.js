import { onSnapshot } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

/**
 * Membersihkan spinner/loader awal dan memastikan container kosong tanpa kedip
 * saat memuat atau me-refresh halaman.
 */
export function prepareFlickerFreeContainer(container, clearExisting = true) {
    if (!container) return;
    const loaders = container.querySelectorAll('.loader-container, #loadingState, [data-loading="true"]');
    loaders.forEach(el => el.remove());
    if (clearExisting) {
        container.innerHTML = '';
    }
}

/**
 * Menyinkronkan perubahan Firestore snapshot (added, modified, removed) secara inkremental
 * per item key tanpa me-render ulang seluruh daftar (mencegah kedip saat pesan baru masuk).
 */
export function attachFlickerFreeSnapshot({
    queryRef,
    container,
    keyAttr = 'data-item-id',
    createElement,
    updateElement,
    onAddedItem,
    onSnapshotDone,
    onError,
    autoScroll = false,
    scrollThreshold = 120
}) {
    if (!queryRef || !container || typeof createElement !== 'function') {
        return () => {};
    }

    prepareFlickerFreeContainer(container, true);
    let isInitial = true;

    const unsubscribe = onSnapshot(
        queryRef,
        snapshot => {
            const nearBottom = autoScroll
                ? (container.scrollHeight - container.scrollTop - container.clientHeight) < scrollThreshold
                : false;
            let shouldScroll = false;

            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const docData = change.doc.data();
                const existingEl = container.querySelector(`[${keyAttr}="${CSS.escape(docId)}"]`);

                if (change.type === 'added') {
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
                    }
                    if (!isInitial && typeof onAddedItem === 'function') {
                        onAddedItem(docId, docData, change.doc);
                    }
                } else if (change.type === 'modified') {
                    if (existingEl && typeof updateElement === 'function') {
                        updateElement(existingEl, docId, docData, change.doc);
                    }
                } else if (change.type === 'removed') {
                    if (existingEl) {
                        existingEl.remove();
                    }
                }
            });

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
