export function useGetMetadata(path: Ref<string | undefined>) {
    const { pending, data, error, execute } = useFetch<{ filename: string; metadata: PartialMetadata }>('/api/metadata', {
        query: { path: path.value },
        immediate: false,
        watch: false,
    })

    return { pending, error, data, execute }
}
