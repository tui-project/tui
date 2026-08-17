import { describe, expect, it, vi } from 'vitest'
import { publishLog, subscribeToLogs } from '../../../../server/events/log'

describe('log events', () => {
    it('publishes logs to subscribers until they unsubscribe', () => {
        const subscriber = vi.fn()
        const entry = { id: 1, time: '2026-08-17T00:00:00.000Z', type: 'info', msg: 'Ready' } as LogEntry
        const unsubscribe = subscribeToLogs(subscriber)

        publishLog(entry)
        unsubscribe()
        publishLog(entry)

        expect(subscriber).toHaveBeenCalledOnce()
        expect(subscriber).toHaveBeenCalledWith(entry)
    })
})
