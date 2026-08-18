import { createError, createEventStream, getCookie, getRequestURL, sendError, sendRedirect } from 'h3'
import { deleteExpiredSessions, findActiveSessionById } from '../repositories/session-repository'
import { createLogger } from '../utils/logger'

const logger = createLogger('auth')

const BYPASS_PATHS = ['/setup', '/api/setup', '/login', '/api/login', '/api/_nuxt_icon', '/_ipx']

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const isBypassed = BYPASS_PATHS.some((bypassPath) => path === bypassPath || path.startsWith(`${bypassPath}/`))

    if (isBypassed) {
        return
    }

    const sessionId = getCookie(event, 'session_id')
    if (!sessionId) {
        logger.warn('Missing session. Rejecting request.', { path })
        return rejectUnauthorizedRequest(event, path)
    }

    await deleteExpiredSessions()

    const session = await findActiveSessionById(sessionId)
    if (!session) {
        logger.warn('Invalid or expired session. Rejecting request.', { path, sessionId })
        return rejectUnauthorizedRequest(event, path)
    }
})

function rejectUnauthorizedRequest(event: Parameters<typeof getRequestURL>[0], path: string) {
    if (path.startsWith('/api/') && path.endsWith('/stream')) {
        const eventStream = createEventStream(event)
        void eventStream.push({ event: 'unauthorised', data: 'Unauthorized' })

        return eventStream.send()
    } else if (path.startsWith('/api/')) {
        return sendError(event, createError({ statusCode: 401, message: 'Unauthorized' }))
    } else {
        return sendRedirect(event, '/login')
    }
}
