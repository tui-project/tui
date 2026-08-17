import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let unmountHandler: (() => void) | undefined
let apiMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    unmountHandler = undefined
    apiMock = vi.fn()
    vi.stubGlobal('useNuxtApp', () => ({ $api: apiMock }))
    vi.stubGlobal('onMounted', (handler: () => void) => handler())
    vi.stubGlobal('onBeforeUnmount', (handler: () => void) => {
        unmountHandler = handler
    })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('useApiEventStream', () => {
    it('parses named and multiline events, then reconnects', async () => {
        const firstStream = createStream(['event: request\r\ndata: {"id":', '"one"}\r\ndata: second\r\n\r', '\nevent: ignored\n\n'])
        const secondStream = createStream()
        apiMock.mockResolvedValueOnce(firstStream).mockResolvedValueOnce(secondStream)
        const onEvent = vi.fn()
        const onOpen = vi.fn()
        const onError = vi.fn()
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent, onOpen, onError })
        await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())

        expect(onOpen).toHaveBeenCalledWith(false)
        expect(onEvent).toHaveBeenCalledWith('request', '{"id":"one"}\nsecond')
        expect(onEvent).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(3000)
        await vi.waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2))
        expect(onOpen).toHaveBeenLastCalledWith(true)

        unmountHandler?.()
        expect(apiMock.mock.calls[1]![1].signal.aborted).toBe(true)
    })

    it('redirects and does not reconnect after a 401 response', async () => {
        apiMock.mockRejectedValue({ response: { status: 401 } })
        const onError = vi.fn()
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent: vi.fn(), onError })
        await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())

        await vi.advanceTimersByTimeAsync(3000)
        expect(apiMock).toHaveBeenCalledOnce()
        unmountHandler?.()
    })

    it('reconnects after request failures and supports omitted lifecycle callbacks', async () => {
        apiMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(createStream(['data: ready\n\n']))
        const onEvent = vi.fn()
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent })
        await vi.waitFor(() => expect(apiMock).toHaveBeenCalledOnce())
        await vi.advanceTimersByTimeAsync(3000)
        await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith('message', 'ready'))

        unmountHandler?.()
    })

    it('forwards non-401 response errors and reconnects', async () => {
        apiMock.mockRejectedValue({ response: { status: 500 } })
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent: vi.fn() })
        await vi.waitFor(() => expect(apiMock).toHaveBeenCalledOnce())
        await vi.advanceTimersByTimeAsync(3000)

        expect(apiMock).toHaveBeenCalledTimes(2)
        unmountHandler?.()
    })

    it('does not reconnect when unmounted while reading', async () => {
        let closeStream: (() => void) | undefined
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                closeStream = () => controller.close()
            },
        })
        apiMock.mockResolvedValue(stream)
        const onError = vi.fn()
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent: vi.fn(), onError })
        await vi.waitFor(() => expect(apiMock).toHaveBeenCalledOnce())
        unmountHandler?.()
        closeStream?.()
        await vi.runAllTimersAsync()

        expect(onError).not.toHaveBeenCalled()
        expect(apiMock).toHaveBeenCalledOnce()
    })

    it('does not report or reconnect a request failure after unmounting', async () => {
        let rejectRequest: ((error: Error) => void) | undefined
        apiMock.mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectRequest = reject
                })
        )
        const onError = vi.fn()
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent: vi.fn(), onError })
        unmountHandler?.()
        rejectRequest?.(new Error('aborted'))
        await vi.runAllTimersAsync()

        expect(onError).not.toHaveBeenCalled()
        expect(apiMock).toHaveBeenCalledOnce()
    })

    it('can stop before the connection starts', async () => {
        let mountHandler: (() => void) | undefined
        vi.stubGlobal('onMounted', (handler: () => void) => {
            mountHandler = handler
        })
        const { useApiEventStream } = await import('../../../../app/composables/useApiEventStream')

        useApiEventStream('/api/events', { onEvent: vi.fn() })
        unmountHandler?.()
        mountHandler?.()
        await vi.runAllTimersAsync()

        expect(apiMock).toHaveBeenCalledOnce()
    })
})

function createStream(chunks: string[] = []) {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
            if (chunks.length) controller.close()
        },
    })
}
