import { describe, expect, it, vi } from 'vitest'

const push = vi.fn().mockResolvedValue(undefined)
const onClosed = vi.fn()
const send = vi.fn().mockReturnValue('stream response')
const unsubscribe = vi.fn()
let subscriber: ((entry: LogEntry) => void) | undefined

vi.mock('h3', () => ({
    createEventStream: vi.fn(() => ({ push, onClosed, send })),
}))

vi.mock('../../../../server/utils/logger', () => ({
    getRecentLogs: vi.fn(() => [
        { id: 1, time: '2026-08-16T00:00:00.000Z', type: 'info', scope: 'startup', msg: 'Ready', context: null },
    ] satisfies LogEntry[]),
    subscribeToLogs: vi.fn((callback: (entry: LogEntry) => void) => {
        subscriber = callback
        return unsubscribe
    }),
}))

describe('logs stream route', () => {
    it('replays recent logs, streams new logs, and unsubscribes when closed', async () => {
        vi.stubGlobal('defineEventHandler', (routeHandler: unknown) => routeHandler)
        const { default: handler } = await import('../../../../server/api/logs/stream.get')
        const event = {} as Parameters<typeof handler>[0]

        expect(handler(event)).toBe('stream response')
        expect(push).toHaveBeenCalledWith({
            id: '1',
            event: 'log',
            data: JSON.stringify({ id: 1, time: '2026-08-16T00:00:00.000Z', type: 'info', scope: 'startup', msg: 'Ready', context: null }),
        })

        const liveEntry = { id: 2, time: '2026-08-16T00:00:01.000Z', type: 'warn', scope: 'auth', msg: 'Missing session', context: { path: '/api/test' } } satisfies LogEntry
        subscriber!(liveEntry)

        expect(push).toHaveBeenLastCalledWith({ id: '2', event: 'log', data: JSON.stringify(liveEntry) })
        expect(onClosed).toHaveBeenCalledWith(unsubscribe)
        expect(send).toHaveBeenCalledOnce()
    })
})
