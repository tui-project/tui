const MAX_CLIENT_LOGS = 1000

export function useStreamLogs() {
    const logs = ref<LogEntry[]>([])
    const connected = ref(false)
    const error = ref(false)

    useApiEventStream('/api/logs/stream', {
        onEvent(event, data) {
            if (event !== 'log') return
            logs.value.push(JSON.parse(data) as LogEntry)
            logs.value.splice(0, Math.max(0, logs.value.length - MAX_CLIENT_LOGS))
        },
        onOpen() {
            connected.value = true
            error.value = false
        },
        onError() {
            connected.value = false
            error.value = true
        },
    })

    function clear() {
        logs.value = []
    }

    return { logs, connected, error, clear }
}
