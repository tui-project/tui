import { logger } from '../utils/logger'

const SKYHOOK_BASE_URL = 'https://skyhook.sonarr.tv/v1/tvdb/shows/en/'

interface SkyHookSeries {
    tvdbId: number
    title: string
}

export async function getTvdbSeries(tvdbId: number): Promise<SkyHookSeries | null> {
    const url = `${SKYHOOK_BASE_URL}${tvdbId}`
    logger.debug('SkyHook series lookup request prepared.', { tvdbId })

    try {
        return await $fetch<SkyHookSeries>(url)
    } catch (error: unknown) {
        logger.warn('SkyHook series lookup failed.', { tvdbId, error: toLoggableFetchError(error) })
        return null
    }
}

function toLoggableFetchError(error: unknown) {
    if (!error || typeof error !== 'object') return { message: String(error) }

    const payload = error as { name?: unknown; message?: unknown; statusCode?: unknown }
    return {
        name: typeof payload.name === 'string' ? payload.name : undefined,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : undefined,
    }
}
