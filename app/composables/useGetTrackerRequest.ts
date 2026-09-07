export function useGetTrackerRequest() {
    const id = ref('')
    const {
        pending,
        data,
        error,
        execute: fetchRequest,
    } = useApiFetch<{ filepath: string; folder: boolean; filename: string; metadata: Metadata; description: string }>(
        () => `/api/tracker/requests/${encodeURIComponent(id.value)}`,
        {
            immediate: false,
            watch: false,
        }
    )

    function execute(requestId: string) {
        id.value = requestId
        return fetchRequest()
    }

    return { pending, data, error, execute }
}
