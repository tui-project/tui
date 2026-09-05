import { deleteCookie, getCookie, setResponseStatus } from 'h3'
import { removeSessionById } from '../repositories/session-repository'
import { getSettings } from '../repositories/settings-repository'
import { createLogger } from '../utils/logger'

const logger = createLogger('API')

export default defineEventHandler(async (event) => {
    logger.trace('Logout request received.')

    const sessionId = getCookie(event, 'session_id')

    if (sessionId) {
        await removeSessionById(sessionId)
        logger.info('Logout succeeded and session removed.')
    }

    const settings = await getSettings()
    deleteCookie(event, 'session_id', {
        path: '/',
        secure: settings.secureSessionCookie,
    })

    setResponseStatus(event, 204)
})
