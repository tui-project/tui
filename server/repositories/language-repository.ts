import type { Language, LanguageCacheMeta } from '../model/language'
import { getLanguages } from '../services/tmdb'
import { languageCollection } from '../utils/db'
import { logger } from '../utils/logger'

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function refreshLanguages(): Promise<void> {
    const languages = await getLanguages()
    if (!languages) {
        logger.warn('Failed to fetch languages from TMDB — keeping existing data.')
        return
    }

    await languageCollection.removeAsync({ _id: { $ne: 'meta' } }, { multi: true })
    await languageCollection.insertAsync(languages)
    await languageCollection.updateAsync({ _id: 'meta' }, { $set: { refreshedAt: new Date() } }, { upsert: true })

    logger.info('Language cache refreshed.', { count: languages.length })
}

export async function getLanguageDisplayName(code: string): Promise<string | null> {
    const meta = (await languageCollection.findOneAsync({ _id: 'meta' })) as LanguageCacheMeta | null
    const isStale = !meta || Date.now() - new Date(meta.refreshedAt).getTime() > REFRESH_INTERVAL_MS
    if (isStale) {
        void refreshLanguages()
    }

    const entry = (await languageCollection.findOneAsync({ iso_639_1: code })) as Language | null
    return entry?.english_name ?? null
}
