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

describe('useStreamTrackerRequests', () => {
    beforeEach(() => {
        vi.stubGlobal('EventSource', EventSourceMock)
        navigateToMock.mockReset()
    })
    afterEach(() => vi.unstubAllGlobals())

    it('replaces requests from snapshots, applies updates, reports connection state, and closes', async () => {
        let stream: ReturnType<typeof useStreamTrackerRequests> | undefined
        const rendered = await renderSuspended(
            defineComponent({
                setup() {
                    stream = useStreamTrackerRequests()
                    return () => null
                },
            })
        )
        const source = EventSourceMock.instance
        const request = { id: 'upload-1', status: 'pending' }
        const otherRequest = { id: 'upload-2', status: 'pending' }

        expect(source.url).toBe('/api/tracker/requests/stream')
        expect(stream?.pending.value).toBe(true)

        source.emit('open')
        expect(stream?.connected.value).toBe(true)
        expect(stream?.error.value).toBe(false)

        source.emit('snapshot', new MessageEvent('snapshot', { data: JSON.stringify({ items: [request, otherRequest], total: 2 }) }))
        expect(stream?.requests.value).toEqual([request, otherRequest])
        expect(stream?.pending.value).toBe(false)

        source.emit('request', new MessageEvent('request', { data: JSON.stringify({ ...request, status: 'success' }) }))
        expect(stream?.requests.value).toEqual([{ ...request, status: 'success' }, otherRequest])

        source.emit('error')
        expect(stream?.connected.value).toBe(false)
        expect(stream?.error.value).toBe(true)

        source.emit('open')
        expect(stream?.connected.value).toBe(true)
        expect(stream?.error.value).toBe(false)

        rendered.unmount()
        await nextTick()
        expect(source.close).toHaveBeenCalledOnce()
    })

    it('prepends new requests and retains only the latest 12', async () => {
        let stream: ReturnType<typeof useStreamTrackerRequests> | undefined
        await renderSuspended(
            defineComponent({
                setup() {
                    stream = useStreamTrackerRequests()
                    return () => null
                },
            })
        )
        const requests = Array.from({ length: 12 }, (_, index) => ({ id: `upload-${index}`, status: 'pending' }))
        EventSourceMock.instance.emit('snapshot', new MessageEvent('snapshot', { data: JSON.stringify({ items: requests, total: requests.length }) }))

        const newest = { id: 'upload-new', status: 'pending' }
        EventSourceMock.instance.emit('request', new MessageEvent('request', { data: JSON.stringify(newest) }))

        expect(stream?.requests.value).toHaveLength(12)
        expect(stream?.requests.value[0]).toEqual(newest)
        expect(stream?.requests.value).not.toContainEqual(requests.at(-1))
    })

    it('closes and redirects to login when the stream reports an unauthorised session', async () => {
        await renderSuspended(
            defineComponent({
                setup() {
                    useStreamTrackerRequests()
                    return () => null
                },
            })
        )

        EventSourceMock.instance.emit('unauthorised')

        expect(EventSourceMock.instance.close).toHaveBeenCalledOnce()
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })
})
