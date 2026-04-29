import { sendRedirect } from 'h3'
import { logger } from '../utils/logger'

export default defineEventHandler(async (event) => {
    logger.trace('Root route request received.')

    logger.debug('Setup completed. Redirecting user to login page.')
    return sendRedirect(event, '/login')
})
