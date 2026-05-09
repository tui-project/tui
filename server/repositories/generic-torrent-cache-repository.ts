import type { GenericTorrentCache } from '../model/generic-torrent-cache'
import { genericTorrentCacheCollection } from '../utils/db'

export async function findGenericTorrentCacheByFilepath(filepath: string) {
    return genericTorrentCacheCollection.findOneAsync({ filepath } as GenericTorrentCache)
}

export async function saveGenericTorrentCache(cache: GenericTorrentCache) {
    await genericTorrentCacheCollection.updateAsync({ filepath: cache.filepath }, cache, { upsert: true })
}
