export function useMetadata() {
    const loading = ref(false)
    const error = ref(false)

    async function getMetadata(path: string) {
        if (loading.value) {
            return
        }

        loading.value = true
        error.value = false

        try {
            return await $fetch<Metadata>('/api/metadata', {
                method: 'GET',
                query: { path },
            })
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    return {
        getMetadata,
        loading,
        error,
    }
}
