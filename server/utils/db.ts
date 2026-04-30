import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Datastore, { type Document } from '@seald-io/nedb'
import type { Session } from '../model/session'
import type { User } from '../model/user'
import { logger } from './logger'

export type UserDocument = Document<User>
export type SessionDocument = Document<Session>

const dataDir = process.env.DATABASE_DIR ?? join(process.cwd(), 'config', 'database')

mkdirSync(dataDir, { recursive: true })
logger.trace(`Initialising database in data directory: ${dataDir}`)

const userCollectionDataDir = join(dataDir, 'users.db')
export const userCollection = new Datastore<User>({
    filename: userCollectionDataDir,
    autoload: true,
    timestampData: true,
})

const sessionCollectionDataDir = join(dataDir, 'sessions.db')
export const sessionCollection = new Datastore<Session>({
    filename: sessionCollectionDataDir,
    autoload: true,
    timestampData: true,
})

logger.debug(`Users datastore initialized: ${userCollectionDataDir}`)
logger.debug(`Sessions datastore initialized: ${sessionCollectionDataDir}`)
logger.info('Database initialised.')
