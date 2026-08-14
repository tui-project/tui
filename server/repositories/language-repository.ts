import { getLanguages } from '../services/tmdb'
import { languageCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:language')

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function refreshLanguages(): Promise<void> {
    logger.trace('Refreshing language records.')

    const languages = await getLanguages()
    if (!languages) {
        logger.warn('Failed to fetch languages from TMDB — keeping existing data.')
        return
    }

    await languageCollection.removeAsync({}, { multi: true })
    await languageCollection.insertAsync(languages)

    logger.info('Language cache refreshed.', { count: languages.length })
}

export async function getLanguageDisplayName(code: string): Promise<string | null> {
    logger.trace('Finding language display name.', { languageCode: code })

    const entry = await languageCollection.findOneAsync({ iso_639_1: code })
    const isStale = !entry || !entry.updatedAt || Date.now() - new Date(entry.updatedAt).getTime() > REFRESH_INTERVAL_MS

    if (isStale) {
        void refreshLanguages()
    }

    return entry?.english_name ?? null
}
