import { createEventStream } from 'h3'
import { subscribeToLogs } from '../../events/log'
import { getRecentLogs } from '../../utils/logger'

export default defineEventHandler((event) => {
    const eventStream = createEventStream(event)

    void eventStream.push({ event: 'snapshot', data: JSON.stringify(getRecentLogs()) })

    const unsubscribe = subscribeToLogs((entry) => {
        void eventStream.push({ id: String(entry.id), event: 'log', data: JSON.stringify(entry) })
    })

    eventStream.onClosed(unsubscribe)

    return eventStream.send()
})
