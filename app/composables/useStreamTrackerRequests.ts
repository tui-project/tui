export function useStreamTrackerRequests(onRequest: (request: TrackerRequestResponse) => void, onReconnect: () => void | Promise<void>) {
    let eventSource: EventSource | undefined
    let reconnecting = false

    onMounted(() => {
        eventSource = new EventSource('/api/tracker/requests/stream')
        eventSource.addEventListener('open', onOpen)
        eventSource.addEventListener('error', onError)
        eventSource.addEventListener('request', onRequestEvent)
    })

    onBeforeUnmount(() => {
        eventSource?.close()
    })

    function onOpen() {
        if (reconnecting) {
            reconnecting = false
            void onReconnect()
        }
    }

    function onError() {
        reconnecting = true
    }

    function onRequestEvent(event: MessageEvent<string>) {
        onRequest(JSON.parse(event.data) as TrackerRequestResponse)
    }
}
