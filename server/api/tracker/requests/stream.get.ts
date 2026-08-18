import { createEventStream } from 'h3'
import { subscribeToTrackerRequests } from '../../../events/tracker-request'
import { getTrackerRequests } from '../../../repositories/tracker-request-repository'

const DASHBOARD_REQUEST_LIMIT = 12

export default defineEventHandler(async (event) => {
    const eventStream = createEventStream(event)
    const snapshot = await getTrackerRequests(1, DASHBOARD_REQUEST_LIMIT)

    const unsubscribe = subscribeToTrackerRequests((request) => {
        void eventStream.push({ id: request.id, event: 'request', data: JSON.stringify(request) })
    })

    void eventStream.push({ event: 'snapshot', data: JSON.stringify(snapshot) })
    eventStream.onClosed(unsubscribe)

    return eventStream.send()
})
