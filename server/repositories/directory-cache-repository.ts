import type { DirectoryCache } from '../model/directory-cache'
import { directoryCacheCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:directory-cache')

export async function getDirectoryCache(path: string) {
    logger.trace('Finding directory cache entry.')
    return directoryCacheCollection.findOneAsync({ path } as DirectoryCache)
}

export async function saveDirectoryCache(directoryCache: DirectoryCache) {
    logger.trace('Saving directory cache entry.')
    await directoryCacheCollection.updateAsync({ path: directoryCache.path }, directoryCache, { upsert: true })
}
