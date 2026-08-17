import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const { useApiEventStreamMock } = vi.hoisted(() => ({ useApiEventStreamMock: vi.fn() }))

mockNuxtImport('useApiEventStream', () => useApiEventStreamMock)

describe('useStreamTrackerRequests', () => {
    beforeEach(() => useApiEventStreamMock.mockReset())

    it('handles request events and refreshes after reconnection', async () => {
        const onRequest = vi.fn()
        const onReconnect = vi.fn()
        await renderSuspended(
            defineComponent({
                setup() {
                    useStreamTrackerRequests(onRequest, onReconnect)
                    return () => null
                },
            })
        )
        const [url, options] = useApiEventStreamMock.mock.calls[0]!

        expect(url).toBe('/api/tracker/requests/stream')
        options.onEvent('other', '{}')
        options.onEvent('request', JSON.stringify({ id: 'upload-1', status: 'pending' }))
        expect(onRequest).toHaveBeenCalledWith({ id: 'upload-1', status: 'pending' })

        options.onOpen(false)
        expect(onReconnect).not.toHaveBeenCalled()
        options.onOpen(true)
        expect(onReconnect).toHaveBeenCalledOnce()
    })
})
