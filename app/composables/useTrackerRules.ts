import type { Metadata } from '~/components/upload/upload.types'
import { computed, ref } from 'vue'

export interface RuleViolation {
    rule: string
    message: string
}

export function useTrackerRules() {
    const pendingCount = ref(0)
    const error = ref(false)

    const loading = computed(() => pendingCount.value > 0)

    async function getViolations(trackerCode: string, metadata: Metadata): Promise<RuleViolation[]> {
        pendingCount.value++
        error.value = false

        try {
            const { violations } = await $fetch<{ violations: RuleViolation[] }>(`/api/tracker/${trackerCode}/rules`, {
                method: 'POST',
                body: { metadata: sanitizeMetadataForUpload(metadata) },
            })
            return violations
        } catch {
            error.value = true
            return []
        } finally {
            pendingCount.value--
        }
    }

    return {
        getViolations,
        loading,
        error: readonly(error),
    }
}

function sanitizeMetadataForUpload(metadata: Metadata): Partial<Metadata> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null && value !== '')) as Partial<Metadata>
}
