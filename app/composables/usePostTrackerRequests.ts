export type TrackerRequestBody = {
    filepath: string
    metadata: Metadata
    description: string
    trackers: TrackerItem[]
}

export function usePostTrackerRequests(body: Ref<TrackerRequestBody>) {
    const { pending, error, execute } = useFetch('/api/tracker/requests', {
        method: 'POST',
        body,
        immediate: false,
        watch: false,
    })

    return { pending, error, execute }
}
