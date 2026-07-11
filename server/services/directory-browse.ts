import { readdir, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDirectoryCache, saveDirectoryCache } from '../repositories/directory-cache-repository'
import { logger } from '../utils/logger'
import { type MediaPathItem, sortPathItems } from '../utils/file-system'

export async function listChildren(parent: string) {
    const parentRealPath = await realpath(parent)
    const [cached, signature] = await Promise.all([getDirectoryCache(parentRealPath), getDirectorySignature(parentRealPath)])

    if (cached) {
        if (cached.signature === signature) {
            logger.trace('Directory browse cache hit.', { parent: parentRealPath })
            return cached.items
        }

        logger.trace('Directory browse cache stale.', { parent: parentRealPath })

        const items = await loadChildren(parentRealPath)
        void saveChildrenCache(parentRealPath, items, signature)

        return items
    }

    logger.trace('Directory browse cache miss.', { parent: parentRealPath })

    const items = await loadChildren(parentRealPath)
    void saveChildrenCache(parentRealPath, items, signature)

    return items
}

async function getDirectorySignature(directoryPath: string) {
    const names = await readdir(directoryPath)
    return `${names.length}:${names.sort().join('|')}`
}

async function loadChildren(parentRealPath: string) {
    const names = await readdir(parentRealPath)
    const items = await Promise.all(
        names.map(async (name) => {
            const childPath = join(parentRealPath, name)
            const childStats = await stat(childPath)

            return {
                path: childPath,
                folder: childStats.isDirectory(),
            }
        })
    )

    return sortPathItems(items)
}

function saveChildrenCache(parentRealPath: string, items: MediaPathItem[], signature: string) {
    return saveDirectoryCache({
        path: parentRealPath,
        items,
        signature,
    })
        .then(() => {
            logger.debug('Directory browse cache updated.', { parent: parentRealPath, itemCount: items.length })
        })
        .catch((error: unknown) => {
            logger.error('Failed to update directory cache.', error)
        })
}
