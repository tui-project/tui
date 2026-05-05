import { defineNitroPlugin } from 'nitropack/runtime'
import { initDatastores } from '../utils/db'
import { logger } from '../utils/logger'

export default defineNitroPlugin(async () => {
    await initDatastores()
    logger.info('Database initialised.')
})
