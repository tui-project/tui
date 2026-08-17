import { describe, expect, it, vi } from 'vitest'
import { publishTrackerRequest, subscribeToTrackerRequests } from '../../../../server/events/tracker-request'

describe('tracker request events', () => {
    it('publishes requests to subscribers until they unsubscribe', () => {
        const subscriber = vi.fn()
        const request = { id: 'upload-1' } as TrackerRequestResponse
        const unsubscribe = subscribeToTrackerRequests(subscriber)

        publishTrackerRequest(request)
        unsubscribe()
        publishTrackerRequest(request)

        expect(subscriber).toHaveBeenCalledOnce()
        expect(subscriber).toHaveBeenCalledWith(request)
    })
})
