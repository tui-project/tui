import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Datastore, { type Document } from '@seald-io/nedb'
import type { Session } from '../model/session'
import type { DirectoryCache } from '../model/directory-cache'
import type { GenericTorrentCache } from '../model/generic-torrent-cache'
import type { Settings } from '../model/settings'
import type { TrackerUploadRequest } from '../model/tracker-upload-request'
import type { User } from '../model/user'
import { logger } from './logger'

export type UserDocument = Document<User>
export type SessionDocument = Document<Session>
export type SettingsDocument = Document<Settings>
export type DirectoryCacheDocument = Document<DirectoryCache>
export type GenericTorrentCacheDocument = Document<GenericTorrentCache>
export type TrackerUploadRequestDocument = Document<TrackerUploadRequest>

const AUTO_COMPACTION_INTERVAL_MS = 60_000
const dataDir = process.env.DATABASE_DIR ?? join(process.cwd(), 'config', 'database')

mkdirSync(dataDir, { recursive: true })
logger.debug(`Initialising database in data directory: ${dataDir}`)

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

const genericTorrentCacheCollectionDataDir = join(dataDir, 'generic-torrent-cache.db')
export const genericTorrentCacheCollection = new Datastore<GenericTorrentCache>({
    filename: genericTorrentCacheCollectionDataDir,
    autoload: true,
    timestampData: true,
})

const trackerUploadRequestCollectionDataDir = join(dataDir, 'tracker-upload-requests.db')
export const trackerUploadRequestCollection = new Datastore<TrackerUploadRequest>({
    filename: trackerUploadRequestCollectionDataDir,
    autoload: true,
    timestampData: true,
})

export async function initDatastores() {
    await userCollection.autoloadPromise
    userCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Users datastore initialized: ${userCollectionDataDir}`)

    await sessionCollection.autoloadPromise
    sessionCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Sessions datastore initialized: ${sessionCollectionDataDir}`)

    await settingsCollection.autoloadPromise
    settingsCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Settings datastore initialized: ${settingsCollectionDataDir}`)

    await directoryCacheCollection.autoloadPromise
    directoryCacheCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Directory cache datastore initialized: ${directoryCacheCollectionDataDir}`)

    await genericTorrentCacheCollection.autoloadPromise
    genericTorrentCacheCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Generic torrent cache datastore initialized: ${genericTorrentCacheCollectionDataDir}`)

    await trackerUploadRequestCollection.autoloadPromise
    trackerUploadRequestCollection.setAutocompactionInterval(AUTO_COMPACTION_INTERVAL_MS)
    logger.debug(`Tracker upload request datastore initialized: ${trackerUploadRequestCollectionDataDir}`)
}
