import type { Metadata } from '~/components/upload/upload.types'
import { readonly, ref } from 'vue'

export interface TrackerItem {
    code: string
    title: string
    titleModified: boolean
    anonymous: boolean
    modQueueOptIn: boolean
    uploadStatus?: 'success' | 'failed'
    torrentClientInjected?: boolean
}

export interface TrackerRequest {
    id: string
    filepath: string
    status: string
    trackers: TrackerItem[]
    torrentCreationProgress?: number
    failedTrackerCodes?: string[]
    createdAt?: string
    updatedAt?: string
}

export function useTrackerRequests() {
    const loading = ref(false)
    const error = ref(false)

    async function getRequests(limit: number): Promise<TrackerRequest[] | null> {
        if (loading.value) {
            return null
        }

        loading.value = true
        error.value = false

        try {
            return await $fetch<TrackerRequest[]>('/api/tracker/requests', {
                query: { limit },
            })
        } catch {
            error.value = true
            return null
        } finally {
            loading.value = false
        }
    }

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
        getRequests,
        uploadTorrent,
        retryRequest,
        loading: readonly(loading),
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
