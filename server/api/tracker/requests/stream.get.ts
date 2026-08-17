import { createEventStream } from 'h3'
import { subscribeToTrackerRequests } from '../../../events/tracker-request'

export default defineEventHandler((event) => {
    const eventStream = createEventStream(event)
    const unsubscribe = subscribeToTrackerRequests((request) => {
        void eventStream.push({ id: request.id, event: 'request', data: JSON.stringify(request) })
    })

    eventStream.onClosed(unsubscribe)

    return eventStream.send()
})
