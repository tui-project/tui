import { join } from 'node:path'
import Datastore from '@seald-io/nedb'
import { defineNitroPlugin } from 'nitropack/runtime'
import { initDatastores } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('database')

export default defineNitroPlugin(async () => {
    await initDatastores()
    await removeObsoleteDatastores()

    logger.info('Database initialised.')
})

async function removeObsoleteDatastores() {
    const dataDir = process.env.DATABASE_DIR ?? join(process.cwd(), 'config', 'database')
    const languageCollection = new Datastore({ filename: join(dataDir, 'languages.db') })
    await languageCollection.dropDatabaseAsync()
}
