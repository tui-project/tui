type LogSubscriber = (entry: LogEntry) => void

const subscribers = new Set<LogSubscriber>()

export function publishLog(entry: LogEntry) {
    for (const subscriber of subscribers) {
        subscriber(entry)
    }
}

export function subscribeToLogs(subscriber: LogSubscriber) {
    subscribers.add(subscriber)

    return () => subscribers.delete(subscriber)
}
