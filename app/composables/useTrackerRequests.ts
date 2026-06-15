import { readonly, ref } from 'vue'

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

    return {
        uploadTorrent,
        loading: readonly(loading),
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
