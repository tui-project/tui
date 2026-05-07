import { readdir, stat } from 'node:fs/promises'
import { createError } from 'h3'
import { sep } from 'node:path'
import { logger } from './logger'

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

export function isWithinAnyRoot(pathToCheck: string, allowedRoots: string[]) {
    return allowedRoots.some((rootPath) => pathToCheck === rootPath || pathToCheck.startsWith(`${rootPath}${sep}`))
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
        logger.debug('Resolved media file path directly from file input.', { inputPath })
        return [inputPath]
    }

    if (pathStats.isDirectory()) {
        const names = await readdir(inputPath)
        const sortedNames = names.toSorted((left, right) => left.localeCompare(right))
        const mediaFilePaths: string[] = []

        for (const name of sortedNames) {
            const candidatePath = `${inputPath}${sep}${name}`
            const candidateStats = await stat(candidatePath)

            if (candidateStats.isFile()) {
                mediaFilePaths.push(candidatePath)
            }
        }

        if (mediaFilePaths.length > 0) {
            logger.debug('Resolved media file paths from directory.', { inputPath, fileCount: mediaFilePaths.length })
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
