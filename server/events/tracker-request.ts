type TrackerRequestSubscriber = (request: TrackerRequestResponse) => void

const subscribers = new Set<TrackerRequestSubscriber>()

export function publishTrackerRequest(request: TrackerRequestResponse) {
    for (const subscriber of subscribers) {
        subscriber(request)
    }
}

export function subscribeToTrackerRequests(subscriber: TrackerRequestSubscriber) {
    subscribers.add(subscriber)

    return () => subscribers.delete(subscriber)
}
