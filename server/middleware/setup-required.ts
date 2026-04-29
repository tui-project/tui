import { getRequestURL, sendRedirect } from 'h3'
import { userCount } from '../repositories/user-repository'
import { logger } from '../utils/logger'

const BYPASS_PATHS = ['/setup', '/api/setup']

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const isBypassed = BYPASS_PATHS.some((bypassPath) => path === bypassPath || path.startsWith(`${bypassPath}/`))

    if (isBypassed) {
        return
    }

    const totalUsers = await userCount()
    const setupRequired = totalUsers === 0

    if (!setupRequired) {
        return
    }

    logger.info('Setup required. Redirecting request to setup page.', { path })
    return sendRedirect(event, '/setup')
})
