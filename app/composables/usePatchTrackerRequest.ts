export function usePatchTrackerRequest() {
    const id = ref<string>()

    const {
        pending,
        error,
        execute: _execute,
    } = useFetch(() => `/api/tracker/requests/${id.value}`, {
        method: 'PATCH',
        body: { action: 'retry' },
        immediate: false,
        watch: false,
    })

    function execute(requestId: string) {
        id.value = requestId

        return _execute()
    }

    return { pending, error, execute }
}
