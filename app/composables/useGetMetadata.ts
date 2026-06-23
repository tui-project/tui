export function useGetMetadata() {
    const pathRef = ref<string>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<{ filename: string; metadata: PartialMetadata }>('/api/metadata', {
        query: { path: pathRef },
        immediate: false,
        watch: false,
    })

    function execute(path: string) {
        pathRef.value = path

        return _execute()
    }

    return { pending, error, data, execute }
}
