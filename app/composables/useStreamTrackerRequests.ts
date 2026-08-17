export function useStreamTrackerRequests(onRequest: (request: TrackerRequestResponse) => void, onReconnect: () => void | Promise<void>) {
    useApiEventStream('/api/tracker/requests/stream', {
        onEvent(event, data) {
            if (event === 'request') onRequest(JSON.parse(data) as TrackerRequestResponse)
        },
        onOpen(reconnected) {
            if (reconnected) void onReconnect()
        },
    })
}
