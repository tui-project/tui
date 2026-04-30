import { getCookie, getRequestURL, sendRedirect } from 'h3'
import { deleteExpired, findActiveById } from '../repositories/session-repository'
import { logger } from '../utils/logger'

const BYPASS_PATHS = ['/setup', '/api/setup', '/login', '/api/login', '/_ipx']

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const isBypassed = BYPASS_PATHS.some((bypassPath) => path === bypassPath || path.startsWith(`${bypassPath}/`))

    if (isBypassed) {
        return
    }

    const sessionId = getCookie(event, 'session_id')

    if (!sessionId) {
        logger.warn('Missing session. Redirecting request to login page.', { path })
        return sendRedirect(event, '/login')
    }

    await deleteExpired()
    const session = await findActiveById(sessionId)

    if (!session) {
        logger.warn('Invalid or expired session. Redirecting request to login page.', { path, sessionId })
        return sendRedirect(event, '/login')
    }
})
