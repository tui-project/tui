import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Datastore, { type Document } from '@seald-io/nedb'
import type { User } from '../model/user'
import { logger } from './logger'

export type UserDocument = Document<User>

const dataDir = process.env.DATABASE_DIR ?? join(process.cwd(), 'config', 'database')

mkdirSync(dataDir, { recursive: true })
logger.trace(`Initialising database in data directory: ${dataDir}`)

const userCollectionDataDir = join(dataDir, 'users.db')
export const userCollection = new Datastore<User>({
    filename: userCollectionDataDir,
    autoload: true,
    timestampData: true,
})

logger.debug(`Users datastore initialized: ${userCollectionDataDir}`)
logger.info('Database initialised.')
