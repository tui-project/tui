export type TrackerRequestBody = {
    filepath: string
    metadata: Metadata
    description: string
    trackers: TrackerItem[]
}

export function usePostTrackerRequests() {
    const bodyRef = ref<TrackerRequestBody>()

    const {
        pending,
        error,
        execute: _execute,
    } = useFetch('/api/tracker/requests', {
        method: 'POST',
        body: bodyRef,
        immediate: false,
        watch: false,
    })

    function execute(body: TrackerRequestBody) {
        bodyRef.value = body

        return _execute()
    }

    return { pending, error, execute }
}
