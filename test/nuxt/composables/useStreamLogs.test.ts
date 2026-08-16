import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, nextTick } from 'vue'

class EventSourceMock {
    static instance: EventSourceMock

    listeners = new Map<string, EventListener>()
    close = vi.fn()

    constructor(public url: string) {
        EventSourceMock.instance = this
    }

    addEventListener(type: string, listener: EventListener) {
        this.listeners.set(type, listener)
    }

    emit(type: string, event = new Event(type)) {
        this.listeners.get(type)?.(event)
    }
}

describe('useStreamLogs', () => {
    beforeEach(() => {
        vi.stubGlobal('EventSource', EventSourceMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('connects, receives logs, reports errors, clears, and closes', async () => {
        let liveLogs: ReturnType<typeof useStreamLogs> | undefined
        const component = defineComponent({
            setup() {
                liveLogs = useStreamLogs()
                return () => null
            },
        })

        const rendered = await renderSuspended(component)
        const source = EventSourceMock.instance
        expect(source.url).toBe('/api/logs/stream')

        source.emit('open')
        expect(liveLogs?.connected.value).toBe(true)
        expect(liveLogs?.error.value).toBe(false)

        source.emit(
            'log',
            new MessageEvent('log', {
                data: JSON.stringify({ id: 1, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: 'ready' }),
            })
        )
        expect(liveLogs?.logs.value).toHaveLength(1)

        source.emit('error')
        expect(liveLogs?.connected.value).toBe(false)
        expect(liveLogs?.error.value).toBe(true)

        liveLogs?.clear()
        expect(liveLogs?.logs.value).toEqual([])

        rendered.unmount()
        await nextTick()
        expect(source.close).toHaveBeenCalledOnce()
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

        for (let id = 1; id <= 1001; id += 1) {
            EventSourceMock.instance.emit('log', new MessageEvent('log', { data: JSON.stringify({ id, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: String(id) }) }))
        }

        expect(liveLogs?.logs.value).toHaveLength(1000)
        expect(liveLogs?.logs.value[0]?.id).toBe(2)
    })
})
