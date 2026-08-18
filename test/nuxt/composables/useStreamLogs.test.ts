import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, nextTick } from 'vue'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))

mockNuxtImport('navigateTo', () => navigateToMock)

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
        navigateToMock.mockReset()
    })

    it('closes and redirects to login when the stream reports an unauthorised session', async () => {
        await renderSuspended(
            defineComponent({
                setup() {
                    useStreamLogs()
                    return () => null
                },
            })
        )

        EventSourceMock.instance.emit('unauthorised')

        expect(EventSourceMock.instance.close).toHaveBeenCalledOnce()
        expect(navigateToMock).toHaveBeenCalledWith('/login')
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
            'snapshot',
            new MessageEvent('snapshot', {
                data: JSON.stringify([{ id: 1, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: 'ready' }]),
            })
        )
        expect(liveLogs?.logs.value).toHaveLength(1)

        source.emit(
            'log',
            new MessageEvent('log', {
                data: JSON.stringify({ id: 2, time: '2026-08-15T01:00:01.000Z', type: 'warn', msg: 'live' }),
            })
        )
        expect(liveLogs?.logs.value).toHaveLength(2)

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

    it('retains only the latest 1,000 entries from the initial snapshot', async () => {
        let liveLogs: ReturnType<typeof useStreamLogs> | undefined
        await renderSuspended(
            defineComponent({
                setup() {
                    liveLogs = useStreamLogs()
                    return () => null
                },
            })
        )
        const entries = Array.from({ length: 1001 }, (_, index) => ({
            id: index + 1,
            time: '2026-08-15T01:00:00.000Z',
            type: 'info',
            msg: String(index + 1),
        }))

        EventSourceMock.instance.emit('snapshot', new MessageEvent('snapshot', { data: JSON.stringify(entries) }))

        expect(liveLogs?.logs.value).toHaveLength(1000)
        expect(liveLogs?.logs.value[0]?.id).toBe(2)
    })
})
