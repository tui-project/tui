import type { Settings } from '../model/settings'
import { settingsCollection } from '../utils/db'

export const DEFAULT_SETTINGS: Settings = {
    id: 'app-settings',
    mediaPaths: [],
    tmdbApiKey: '',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    movieScreenshotCount: 6,
    tvEpisodeScreenshotCount: 1,
    imgbbApiKey: '',
}

export async function getSettings() {
    const settings = await settingsCollection.findOneAsync({ id: DEFAULT_SETTINGS.id } as Settings)

    return {
        ...DEFAULT_SETTINGS,
        ...settings,
    }
}

export async function saveSettings(settingsInput: Omit<Settings, 'id'>) {
    const settings: Settings = {
        id: DEFAULT_SETTINGS.id,
        ...settingsInput,
    }

    await settingsCollection.updateAsync({ id: DEFAULT_SETTINGS.id }, settings, { upsert: true })
    return settings
}
