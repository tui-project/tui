import { describe, expect, it, vi } from 'vitest'

const push = vi.fn().mockResolvedValue(undefined)
const onClosed = vi.fn()
const send = vi.fn().mockReturnValue('stream response')
const unsubscribe = vi.fn()
let subscriber: ((request: TrackerRequestResponse) => void) | undefined
const snapshot = { items: [{ id: 'upload-1', status: 'pending' }], total: 1 }

vi.mock('h3', () => ({ createEventStream: vi.fn(() => ({ push, onClosed, send })) }))
vi.mock('../../../../server/events/tracker-request', () => ({
    subscribeToTrackerRequests: vi.fn((callback: (request: TrackerRequestResponse) => void) => {
        subscriber = callback
        return unsubscribe
    }),
}))
vi.mock('../../../../server/repositories/tracker-request-repository', () => ({
    getTrackerRequests: vi.fn().mockResolvedValue(snapshot),
}))

describe('tracker requests stream route', () => {
    it('streams request updates and unsubscribes when closed', async () => {
        vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
        const { default: handler } = await import('../../../../server/api/tracker/requests/stream.get')
        const event = {} as Parameters<typeof handler>[0]

        await expect(handler(event)).resolves.toBe('stream response')
        const request = { id: 'upload-1', status: 'pending' } as TrackerRequestResponse
        subscriber?.(request)

        expect(push).toHaveBeenCalledWith({ event: 'snapshot', data: JSON.stringify(snapshot) })
        expect(push).toHaveBeenCalledWith({ id: 'upload-1', event: 'request', data: JSON.stringify(request) })
        expect(onClosed).toHaveBeenCalledWith(unsubscribe)
        expect(send).toHaveBeenCalledOnce()
    })
})
