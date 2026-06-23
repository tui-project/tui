import { defineNitroPlugin } from 'nitropack/runtime'
import { refreshLanguages } from '../repositories/language-repository'
import { backfillTrackerRequestGroupIds } from '../repositories/tracker-request-repository'
import { initDatastores } from '../utils/db'
import { logger } from '../utils/logger'

export default defineNitroPlugin(async () => {
    await initDatastores()
    await backfillTrackerRequestGroupIds()
    void refreshLanguages()

    logger.info('Database initialised.')
})
