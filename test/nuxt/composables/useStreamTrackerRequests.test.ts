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

describe('useStreamTrackerRequests', () => {
    beforeEach(() => vi.stubGlobal('EventSource', EventSourceMock))
    afterEach(() => vi.unstubAllGlobals())

    it('streams requests, refreshes only after reconnection, and closes', async () => {
        const onRequest = vi.fn()
        const onReconnect = vi.fn()
        const rendered = await renderSuspended(
            defineComponent({
                setup() {
                    useStreamTrackerRequests(onRequest, onReconnect)
                    return () => null
                },
            })
        )
        const source = EventSourceMock.instance

        expect(source.url).toBe('/api/tracker/requests/stream')
        source.emit('open')
        expect(onReconnect).not.toHaveBeenCalled()

        source.emit('request', new MessageEvent('request', { data: JSON.stringify({ id: 'upload-1', status: 'pending' }) }))
        expect(onRequest).toHaveBeenCalledWith({ id: 'upload-1', status: 'pending' })

        source.emit('error')
        source.emit('open')
        expect(onReconnect).toHaveBeenCalledOnce()

        rendered.unmount()
        await nextTick()
        expect(source.close).toHaveBeenCalledOnce()
    })
})
