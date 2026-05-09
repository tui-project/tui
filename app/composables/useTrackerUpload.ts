import type { Metadata } from '~/components/upload/upload.types'
import { readonly, ref } from 'vue'

export function useTrackerUpload() {
    const loading = ref(false)
    const error = ref(false)

    async function uploadTorrent(filepath: string, metadata: Metadata, description: string | undefined, trackerCodes: string[]): Promise<void> {
        if (loading.value) {
            return
        }

        loading.value = true
        error.value = false

        try {
            await $fetch('/api/tracker/upload', {
                method: 'POST',
                body: {
                    filepath,
                    metadata: sanitizeMetadataForUpload(metadata),
                    description,
                    trackerCodes,
                },
            })
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    return {
        uploadTorrent,
        loading: readonly(loading),
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
