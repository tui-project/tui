interface ApiEventStreamOptions {
    onEvent: (event: string, data: string) => void
    onOpen?: (reconnected: boolean) => void
    onError?: () => void
}

const RECONNECT_DELAY_MS = 3000

export function useApiEventStream(url: string, options: ApiEventStreamOptions) {
    const nuxtApp = useNuxtApp()
    let abortController: AbortController | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let connected = false
    let stopped = false

    onMounted(() => void connect())
    onBeforeUnmount(stop)

    async function connect() {
        abortController = new AbortController()

        try {
            const stream = await $fetch<ReadableStream<Uint8Array>>(url, {
                responseType: 'stream',
                signal: abortController.signal,
                async onResponseError({ response }) {
                    if (response.status === 401) {
                        await nuxtApp.runWithContext(() => navigateTo('/login'))
                    }
                },
            })

            options.onOpen?.(connected)
            connected = true
            await readEventStream(stream, options.onEvent)

            if (!stopped) {
                options.onError?.()
                scheduleReconnect()
            }
        } catch (requestError) {
            if (!stopped) {
                options.onError?.()
                if (getResponseStatus(requestError) !== 401) scheduleReconnect()
            }
        }
    }

    function scheduleReconnect() {
        reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS)
    }

    function stop() {
        stopped = true
        abortController?.abort()
        if (reconnectTimer) clearTimeout(reconnectTimer)
    }
}

function getResponseStatus(error: unknown) {
    return (error as { response?: { status?: number } }).response?.status
}

async function readEventStream(stream: ReadableStream<Uint8Array>, onEvent: ApiEventStreamOptions['onEvent']) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })

        let boundary = findEventBoundary(buffer)
        while (boundary) {
            const block = buffer.slice(0, boundary.index)
            buffer = buffer.slice(boundary.index + boundary.length)
            dispatchEventBlock(block, onEvent)
            boundary = findEventBoundary(buffer)
        }

        if (done) return
    }
}

function findEventBoundary(buffer: string) {
    const match = /\r?\n\r?\n/.exec(buffer)
    return match ? { index: match.index, length: match[0].length } : undefined
}

function dispatchEventBlock(block: string, onEvent: ApiEventStreamOptions['onEvent']) {
    let event = 'message'
    const data: string[] = []

    for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trimStart()
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    }

    if (data.length) onEvent(event, data.join('\n'))
}
