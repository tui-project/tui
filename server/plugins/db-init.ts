import { defineNitroPlugin } from 'nitropack/runtime'
import { refreshLanguages } from '../repositories/language-repository'
import { backfillTrackerRequestGroupIds } from '../repositories/tracker-request-repository'
import { initDatastores } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('database')

export default defineNitroPlugin(async () => {
    await initDatastores()
    await backfillTrackerRequestGroupIds()
    void refreshLanguages()

    logger.info('Database initialised.')
})
