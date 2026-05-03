export interface PathResponse {
    path: string
    folder: boolean
}

export function usePath() {
    const loading = ref(false)
    const error = ref(false)

    async function getPaths(parent = '') {
        if (loading.value) {
            return []
        }

        loading.value = true
        error.value = false

        try {
            const query = parent.trim().length > 0 ? { parent } : undefined
            return await $fetch<PathResponse[]>('/api/paths', {
                query,
            })
        } catch {
            error.value = true
            return []
        } finally {
            loading.value = false
        }
    }

    return {
        getPaths,
        loading,
        error,
    }
}
