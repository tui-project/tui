import { sendRedirect } from 'h3'
import { userCount } from '../repositories/user-repository'
import { logger } from '../utils/logger'

export default defineEventHandler(async (event) => {
    logger.trace('Root route request received.')

    const totalUsers = await userCount()
    const setupRequired = totalUsers === 0

    if (setupRequired) {
        logger.info('Setup required. Redirecting user to setup page.')
        return sendRedirect(event, '/setup')
    }

    logger.debug('Setup completed. Redirecting user to login page.')
    return sendRedirect(event, '/login')
})
