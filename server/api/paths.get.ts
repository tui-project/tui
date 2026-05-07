import { createError } from 'h3'
import { stat } from 'node:fs/promises'
import { z } from 'zod'
import { getSettings } from '../repositories/settings-repository'
import { listChildren } from '../services/directory-browse'
import { logger } from '../utils/logger'
import { isWithinAnyRoot, sortPathItems } from '../utils/file-system'
import { isBlank } from '../utils/string'
import { parseValidatedQuery } from '../utils/request-validator'

const pathsQuerySchema = z
    .object({
        parent: z.string().trim().optional(),
    })
    .transform(({ parent }) => ({
        parent: parent && parent.length > 0 ? parent : null,
    }))

export default defineEventHandler(async (event) => {
    logger.debug('Paths request received.')

    const { parent } = parseValidatedQuery(event, pathsQuerySchema, {
        errorMessage: 'invalid_parent_path',
        onInvalid: (issues) => logger.warn('Rejected directory browse with invalid parent query.', { issues }),
    })

    logger.debug(`Parent directory: ${parent}`)

    const paths = await browseEligiblePaths(parent)
    logger.debug('Paths response', { parent, itemCount: paths.length })

    return paths
})

async function browseEligiblePaths(parent: string | null) {
    const settings = await getSettings()
    const roots = settings.mediaPaths

    logger.debug('Browsing directories and files')

    try {
        if (isBlank(parent)) {
            logger.debug('Returning configured media roots.')
            logger.trace('Media roots', roots)

            return await listRootPaths(roots)
        }

        logger.debug('Browsing directory children for parent path.', { parent })

        if (!isWithinAnyRoot(parent, roots)) {
            logger.warn('Rejected directory browse because parent path is outside configured roots.', { parent })

            throw createError({
                statusCode: 400,
                message: 'invalid_parent_path',
            })
        }

        return await listChildren(parent)
    } catch (error: unknown) {
        logger.error('Unable to load paths', error)

        throw createError({
            statusCode: 400,
            message: 'invalid_parent_path',
        })
    }
}

async function listRootPaths(roots: string[]) {
    const items = await Promise.all(
        roots.map(async (rootPath) => {
            const rootStats = await stat(rootPath)

            return {
                path: rootPath,
                folder: rootStats.isDirectory(),
            }
        })
    )

    return sortPathItems(items)
}
