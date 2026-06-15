import { computed, ref } from 'vue'

export function useTrackerTitle() {
    const pendingCount = ref(0)
    const error = ref(false)

    const loading = computed(() => pendingCount.value > 0)

    async function getTitle(trackerCode: string, metadata: Metadata) {
        pendingCount.value++
        error.value = false

        try {
            const { title } = await $fetch<{ title: string }>(`/api/tracker/${trackerCode}/title`, {
                method: 'POST',
                body: { metadata: sanitizeMetadataForUpload(metadata) },
            })
            return title
        } catch {
            error.value = true
            return
        } finally {
            pendingCount.value--
        }
    }

    return {
        getTitle,
        loading,
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
