const MAX_DASHBOARD_REQUESTS = 12

export function useStreamTrackerRequests() {
    const requests = ref<TrackerRequestResponse[]>([])
    const pending = ref(true)
    const connected = ref(false)
    const error = ref(false)
    let eventSource: EventSource | undefined

    onMounted(() => {
        eventSource = new EventSource('/api/tracker/requests/stream')
        eventSource.addEventListener('open', onOpen)
        eventSource.addEventListener('error', onError)
        eventSource.addEventListener('snapshot', onSnapshot)
        eventSource.addEventListener('request', onRequestEvent)
    })

    onBeforeUnmount(() => {
        eventSource?.close()
    })

    function onOpen() {
        connected.value = true
        error.value = false
    }

    function onError() {
        connected.value = false
        error.value = true
    }

    function onRequestEvent(event: MessageEvent<string>) {
        const request = JSON.parse(event.data) as TrackerRequestResponse
        const index = requests.value.findIndex((item) => item.id === request.id)
        requests.value = index === -1 ? [request, ...requests.value].slice(0, MAX_DASHBOARD_REQUESTS) : requests.value.map((item) => (item.id === request.id ? request : item))
    }

    function onSnapshot(event: MessageEvent<string>) {
        const snapshot = JSON.parse(event.data) as { items: TrackerRequestResponse[]; total: number }
        requests.value = snapshot.items
        pending.value = false
    }

    return { requests, pending, connected, error }
}
