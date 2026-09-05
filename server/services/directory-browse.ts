import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDirectoryCache, saveDirectoryCache } from '../repositories/directory-cache-repository'
import { createLogger } from '../utils/logger'
import { type MediaPathItem, sortPathItems } from '../utils/file-system'

const logger = createLogger('directory-browse')

export async function listChildren(canonicalParent: string) {
    logger.trace('Listing child folders and files', { parent: canonicalParent })

    const [cached, entries] = await Promise.all([getDirectoryCache(canonicalParent), readdir(canonicalParent, { withFileTypes: true })])
    const signature = getDirectorySignature(entries)

    if (cached) {
        if (cached.signature === signature) {
            logger.debug('Directory browse cache hit.', { parent: canonicalParent })
            return cached.items
        }

        logger.debug('Directory browse cache stale.', { parent: canonicalParent })

        const items = await loadChildren(canonicalParent, entries)
        void saveChildrenCache(canonicalParent, items, signature)

        return items
    }

    logger.debug('Directory browse cache miss.', { parent: canonicalParent })

    const items = await loadChildren(canonicalParent, entries)
    void saveChildrenCache(canonicalParent, items, signature)

    return items
}

function getDirectorySignature(entries: Dirent<string>[]) {
    const names = entries.map((entry) => entry.name)
    return `${names.length}:${names.sort().join('|')}`
}

async function loadChildren(parentRealPath: string, entries: Dirent<string>[]) {
    logger.debug('Loading children,', { parentRealPath })

    const items = await Promise.all(
        entries.map(async (entry) => {
            const path = join(parentRealPath, entry.name)
            const folder = entry.isSymbolicLink() ? (await stat(path)).isDirectory() : entry.isDirectory()
            return { path, folder }
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
            logger.warn('Failed to update directory cache.', error)
        })
}
