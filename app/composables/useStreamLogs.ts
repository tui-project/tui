const MAX_CLIENT_LOGS = 1000

export function useStreamLogs() {
    const logs = ref<LogEntry[]>([])
    const connected = ref(false)
    const error = ref(false)
    let eventSource: EventSource | undefined

    onMounted(() => {
        eventSource = new EventSource('/api/logs/stream')
        eventSource.addEventListener('open', onOpen)
        eventSource.addEventListener('error', onError)
        eventSource.addEventListener('unauthorised', onUnauthorised)
        eventSource.addEventListener('snapshot', onSnapshot)
        eventSource.addEventListener('log', onLog)
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

    function onUnauthorised() {
        eventSource?.close()
        void navigateTo('/login')
    }

    function onLog(event: MessageEvent<string>) {
        logs.value.push(JSON.parse(event.data) as LogEntry)
        logs.value.splice(0, Math.max(0, logs.value.length - MAX_CLIENT_LOGS))
    }

    function onSnapshot(event: MessageEvent<string>) {
        logs.value = (JSON.parse(event.data) as LogEntry[]).slice(-MAX_CLIENT_LOGS)
    }

    function clear() {
        logs.value = []
    }

    return { logs, connected, error, clear }
}
