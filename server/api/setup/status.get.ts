import { count } from '../../repositories/user-repository'
import { logger } from '../../utils/logger'

export default defineEventHandler(async () => {
    logger.debug('Setup status request received.')

    const userCount = await count()
    const setupRequired = userCount === 0

    if (setupRequired) {
        logger.info('Setup your Admin user to login in.')
    }

    return {
        setupRequired,
    }
})
