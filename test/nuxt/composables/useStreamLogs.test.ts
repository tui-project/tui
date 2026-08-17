import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const { useApiEventStreamMock } = vi.hoisted(() => ({ useApiEventStreamMock: vi.fn() }))

mockNuxtImport('useApiEventStream', () => useApiEventStreamMock)

describe('useStreamLogs', () => {
    beforeEach(() => useApiEventStreamMock.mockReset())

    it('receives logs, reports connection state, and clears', async () => {
        let liveLogs: ReturnType<typeof useStreamLogs> | undefined
        await renderSuspended(
            defineComponent({
                setup() {
                    liveLogs = useStreamLogs()
                    return () => null
                },
            })
        )
        const [url, options] = useApiEventStreamMock.mock.calls[0]!

        expect(url).toBe('/api/logs/stream')
        options.onOpen()
        expect(liveLogs?.connected.value).toBe(true)
        expect(liveLogs?.error.value).toBe(false)

        options.onEvent('other', '{}')
        options.onEvent('log', JSON.stringify({ id: 1, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: 'ready' }))
        expect(liveLogs?.logs.value).toHaveLength(1)

        options.onError()
        expect(liveLogs?.connected.value).toBe(false)
        expect(liveLogs?.error.value).toBe(true)

        liveLogs?.clear()
        expect(liveLogs?.logs.value).toEqual([])
    })

    it('retains only the latest 1,000 browser entries', async () => {
        let liveLogs: ReturnType<typeof useStreamLogs> | undefined
        await renderSuspended(
            defineComponent({
                setup() {
                    liveLogs = useStreamLogs()
                    return () => null
                },
            })
        )
        const options = useApiEventStreamMock.mock.calls[0]![1]

        for (let id = 1; id <= 1001; id += 1) {
            options.onEvent('log', JSON.stringify({ id, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: String(id) }))
        }

        expect(liveLogs?.logs.value).toHaveLength(1000)
        expect(liveLogs?.logs.value[0]?.id).toBe(2)
    })
})
