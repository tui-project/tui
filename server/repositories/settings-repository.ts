import type { Settings } from '../model/settings'
import { initDatastores, settingsCollection } from '../utils/db'
import { logger } from '../utils/logger'

const DEFAULT_SETTINGS: Settings = {
    id: 'app-settings',
    mediaPaths: [],
    tmdbApiKey: '',
}

export async function getSettings() {
    const settings = await settingsCollection.findOneAsync({ id: DEFAULT_SETTINGS.id } as Settings)

    return settings ? settings : DEFAULT_SETTINGS
}

export async function saveSettings(settingsInput: Omit<Settings, 'id'>) {
    const settings: Settings = {
        id: DEFAULT_SETTINGS.id,
        ...settingsInput,
    }

    await settingsCollection.updateAsync({ id: DEFAULT_SETTINGS.id }, settings, { upsert: true })
    return settings
}

initDatastores()
    ?.then(async () => {
        const existingSettings = await settingsCollection.findOneAsync({ id: DEFAULT_SETTINGS.id } as Settings)

        if (!existingSettings) {
            await settingsCollection.insertAsync(DEFAULT_SETTINGS)
            logger.info('Default settings were created.')
        }
    })
    .catch((error: unknown) => {
        logger.error('Failed to initialize default settings.', error)
    })
