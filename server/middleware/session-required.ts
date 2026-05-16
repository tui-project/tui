import { getCookie, getRequestURL, sendRedirect } from 'h3'
import { deleteExpiredSessions, findActiveSessionById } from '../repositories/session-repository'
import { logger } from '../utils/logger'

const BYPASS_PATHS = ['/setup', '/api', '/login', '/_ipx']

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const isBypassed = BYPASS_PATHS.some((bypassPath) => path === bypassPath || path.startsWith(`${bypassPath}/`))

    // logger.trace(`Requested path: ${path}.`)

    if (isBypassed) {
        // logger.trace(`Requested path: ${path} is by passed.`)
        return
    }

    const sessionId = getCookie(event, 'session_id')
    if (!sessionId) {
        logger.warn('Missing session. Redirecting request to login page.', { path })
        return sendRedirect(event, '/login')
    }

    await deleteExpiredSessions()
    logger.trace('Expired sessions deleted.')

    const session = await findActiveSessionById(sessionId)
    if (!session) {
        logger.warn('Invalid or expired session. Redirecting request to login page.', { path, sessionId })
        return sendRedirect(event, '/login')
    }
})
