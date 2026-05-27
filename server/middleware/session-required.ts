import { createError, getCookie, getRequestURL, sendError, sendRedirect } from 'h3'
import { deleteExpiredSessions, findActiveSessionById } from '../repositories/session-repository'
import { logger } from '../utils/logger'

const BYPASS_PATHS = ['/setup', '/api/setup', '/login', '/api/login', '/api/_nuxt_icon', '/_ipx']

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const isBypassed = BYPASS_PATHS.some((bypassPath) => path === bypassPath || path.startsWith(`${bypassPath}/`))

    if (isBypassed) {
        return
    }

    const sessionId = getCookie(event, 'session_id')
    if (!sessionId) {
        logger.warn('Missing session. Redirecting request to login page.', { path })

        if (path.startsWith('/api/')) {
            return sendError(event, createError({ statusCode: 401, message: 'Unauthorized' }))
        } else {
            return sendRedirect(event, '/login')
        }
    }

    await deleteExpiredSessions()

    const session = await findActiveSessionById(sessionId)
    if (!session) {
        logger.warn('Invalid or expired session. Redirecting request to login page.', { path, sessionId })

        if (path.startsWith('/api/')) {
            return sendError(event, createError({ statusCode: 401, message: 'Unauthorized' }))
        } else {
            return sendRedirect(event, '/login')
        }
    }
})
