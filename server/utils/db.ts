import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Datastore, { type Document } from '@seald-io/nedb'
import type { Session } from '../model/session'
import type { DirectoryCache } from '../model/directory-cache'
import type { Settings } from '../model/settings'
import type { User } from '../model/user'
import { logger } from './logger'

export type UserDocument = Document<User>
export type SessionDocument = Document<Session>
export type SettingsDocument = Document<Settings>
export type DirectoryCacheDocument = Document<DirectoryCache>

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

const settingsCollectionDataDir = join(dataDir, 'settings.db')
export const settingsCollection = new Datastore<Settings>({
    filename: settingsCollectionDataDir,
    autoload: true,
    timestampData: true,
})

const directoryCacheCollectionDataDir = join(dataDir, 'directory-cache.db')
export const directoryCacheCollection = new Datastore<DirectoryCache>({
    filename: directoryCacheCollectionDataDir,
    autoload: true,
    timestampData: true,
})

logger.debug(`Users datastore initialized: ${userCollectionDataDir}`)
logger.debug(`Sessions datastore initialized: ${sessionCollectionDataDir}`)
logger.debug(`Settings datastore initialized: ${settingsCollectionDataDir}`)
logger.debug(`Directory cache datastore initialized: ${directoryCacheCollectionDataDir}`)
logger.info('Database initialised.')
