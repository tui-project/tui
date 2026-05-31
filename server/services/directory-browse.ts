import { readdir, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDirectoryCache, saveDirectoryCache } from '../repositories/directory-cache-repository'
import { logger } from '../utils/logger'
import { type MediaPathItem, sortPathItems } from '../utils/file-system'

export async function listChildren(parent: string) {
    const parentRealPath = await realpath(parent)
    const cached = await getDirectoryCache(parentRealPath)

    if (cached) {
        logger.trace('Directory browse cache hit.', { parent: parentRealPath })
        void refreshDirectoryCache(parentRealPath, cached.signature)

        return cached.items
    }

    logger.trace('Directory browse cache miss.', { parent: parentRealPath })

    const signature = await getDirectorySignature(parentRealPath)
    const items = await loadChildren(parentRealPath)
    await saveChildrenCache(parentRealPath, items, signature)

    return items
}

async function refreshDirectoryCache(parentRealPath: string, cachedSignature: string) {
    try {
        const signature = await getDirectorySignature(parentRealPath)
        if (signature === cachedSignature) {
            logger.trace('Directory browse cache signature unchanged during async refresh.', { parent: parentRealPath })
            return
        }

        const freshItems = await loadChildren(parentRealPath)
        await saveChildrenCache(parentRealPath, freshItems, signature)

        logger.debug('Directory browse cache refreshed asynchronously.', { parent: parentRealPath, itemCount: freshItems.length })
    } catch (error: unknown) {
        logger.error('Failed to refresh directory cache.', error)
    }
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

async function saveChildrenCache(parentRealPath: string, items: MediaPathItem[], signature: string) {
    await saveDirectoryCache({
        path: parentRealPath,
        items,
        signature,
    })

    logger.debug('Directory browse cache updated.', { parent: parentRealPath, itemCount: items.length })
}
