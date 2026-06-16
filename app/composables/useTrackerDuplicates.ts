import { computed, ref } from 'vue'

export interface DuplicateEntry {
    name: string
    url?: string
    trumpable: boolean
}

export function useTrackerDuplicates() {
    const pendingCount = ref(0)
    const error = ref(false)

    const loading = computed(() => pendingCount.value > 0)

    async function getDuplicates(trackerCode: string, metadata: Metadata): Promise<DuplicateEntry[]> {
        pendingCount.value++
        error.value = false

        try {
            const { duplicates } = await $fetch<{ duplicates: DuplicateEntry[] }>(`/api/tracker/${trackerCode}/duplicates`, {
                method: 'POST',
                body: { metadata },
            })
            return duplicates
        } catch {
            error.value = true
            return []
        } finally {
            pendingCount.value--
        }
    }

    return {
        getDuplicates,
        loading,
        error: readonly(error),
    }
}
