import { deleteCookie, getCookie, setResponseStatus } from 'h3'
import { removeById } from '../repositories/session-repository'
import { logger } from '../utils/logger'

export default defineEventHandler(async (event) => {
    logger.debug('Logout request received.')

    const sessionId = getCookie(event, 'session_id')

    if (sessionId) {
        await removeById(sessionId)
        logger.info('Logout succeeded and session removed.', { sessionId })
    }

    deleteCookie(event, 'session_id', {
        path: '/',
    })

    setResponseStatus(event, 204)
})
