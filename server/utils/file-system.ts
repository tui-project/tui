import { readdir, realpath, stat } from 'node:fs/promises'
import { createError } from 'h3'
import { isAbsolute, join, relative } from 'node:path'
import { createLogger } from './logger'

const logger = createLogger('file-system')
const canonicalRootsCache = new Map<string, Promise<string[]>>()

export interface MediaPathItem {
    path: string
    folder: boolean
}

export function sortPathItems(items: MediaPathItem[]) {
    return items.sort((left, right) => {
        const typeOrder = Number(left.folder) - Number(right.folder)
        if (typeOrder !== 0) {
            return -typeOrder
        }

        return left.path.localeCompare(right.path)
    })
}

export async function resolvePathWithinAnyRoot(pathToCheck: string, allowedRoots: string[]) {
    try {
        const [canonicalPath, canonicalRoots] = await Promise.all([realpath(pathToCheck), getCanonicalRoots(allowedRoots)])
        return canonicalRoots.some((root) => isWithinRoot(canonicalPath, root)) ? canonicalPath : null
    } catch {
        return null
    }
}

function getCanonicalRoots(allowedRoots: string[]) {
    const key = JSON.stringify(allowedRoots)
    const cachedRoots = canonicalRootsCache.get(key)
    if (cachedRoots) {
        return cachedRoots
    }

    const roots = Promise.all(allowedRoots.map((root) => realpath(root))).catch((error: unknown) => {
        canonicalRootsCache.delete(key)
        throw error
    })
    canonicalRootsCache.set(key, roots)
    return roots
}

function isWithinRoot(pathToCheck: string, root: string) {
    const relativePath = relative(root, pathToCheck)
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export function clearCanonicalRootsCache() {
    canonicalRootsCache.clear()
}

export async function resolveMediaFilePath(inputPath: string): Promise<string> {
    logger.trace('Resolving media file path.', { inputPath })

    const mediaFilePaths = await resolveMediaFilePaths(inputPath)
    const mediaFilePath = mediaFilePaths[0] as string

    logger.debug('Resolved media file path.', { inputPath, mediaFilePath })

    return mediaFilePath
}

export async function resolveMediaFilePaths(inputPath: string): Promise<string[]> {
    logger.trace('Resolving media file paths.', { inputPath })

    const pathStats = await stat(inputPath)
    if (pathStats.isFile()) {
        logger.trace('Resolved media file path directly from file input.', { inputPath })

        return [inputPath]
    }

    if (pathStats.isDirectory()) {
        const entries = await readdir(inputPath, { withFileTypes: true })
        const mediaFilePaths = entries
            .filter((entry) => entry.isFile())
            .map((entry) => join(inputPath, entry.name))
            .toSorted((left, right) => left.localeCompare(right))

        if (mediaFilePaths.length > 0) {
            logger.trace('Resolved media file paths from directory.', { inputPath, fileCount: mediaFilePaths.length })
            return mediaFilePaths
        }

        logger.warn('Rejected media file resolution because no files were found in directory.', { path: inputPath })

        throw createError({
            statusCode: 400,
            message: 'no_media_file_found',
        })
    }

    logger.warn('Rejected media file resolution because path is not a file or directory.', { path: inputPath })

    throw createError({
        statusCode: 400,
        message: 'invalid_path',
    })
}
