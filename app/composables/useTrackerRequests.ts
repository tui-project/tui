import type { Metadata } from '~/components/upload/upload.types'
import type { TrackerItem } from '#shared/types/tracker-request'
import { readonly, ref } from 'vue'

export type { TrackerItem, TrackerRequest } from '#shared/types/tracker-request'

export function useTrackerRequests() {
    const loading = ref(false)
    const error = ref(false)

    async function uploadTorrent(filepath: string, metadata: Metadata, description: string | undefined, trackers: TrackerItem[]): Promise<void> {
        if (loading.value) {
            return
        }

        loading.value = true
        error.value = false

        try {
            await $fetch('/api/tracker/requests', {
                method: 'POST',
                body: {
                    filepath,
                    metadata: sanitizeMetadataForUpload(metadata),
                    description,
                    trackers,
                },
            })
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    async function retryRequest(id: string): Promise<void> {
        if (loading.value) {
            return
        }

        loading.value = true
        error.value = false

        try {
            await $fetch(`/api/tracker/requests/${id}`, {
                method: 'PATCH',
                body: { action: 'retry' },
            })
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    return {
        uploadTorrent,
        retryRequest,
        loading: readonly(loading),
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
