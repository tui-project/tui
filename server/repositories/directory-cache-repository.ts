import type { DirectoryCache } from '../model/directory-cache'
import { directoryCacheCollection } from '../utils/db'

export async function getDirectoryCache(path: string) {
    await directoryCacheCollection.autoloadPromise
    return directoryCacheCollection.findOneAsync({ path } as DirectoryCache)
}

export async function saveDirectoryCache(directoryCache: DirectoryCache) {
    await directoryCacheCollection.autoloadPromise
    await directoryCacheCollection.updateAsync({ path: directoryCache.path }, directoryCache, { upsert: true })
}
