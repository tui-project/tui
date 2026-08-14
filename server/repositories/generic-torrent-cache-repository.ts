import type { GenericTorrentCache } from '../model/generic-torrent-cache'
import { genericTorrentCacheCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:generic-torrent-cache')

export async function findGenericTorrentCacheByFilepath(filepath: string) {
    logger.trace('Finding generic torrent cache entry.')
    return genericTorrentCacheCollection.findOneAsync({ filepath } as GenericTorrentCache)
}

export async function saveGenericTorrentCache(cache: GenericTorrentCache) {
    logger.trace('Saving generic torrent cache entry.')
    await genericTorrentCacheCollection.updateAsync({ filepath: cache.filepath }, cache, { upsert: true })
}
