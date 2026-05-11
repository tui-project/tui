import type { Settings } from '../model/settings'
import { settingsCollection } from '../utils/db'

export const DEFAULT_SETTINGS: Settings = {
    id: 'app-settings',
    mediaPaths: [],
    tmdbApiKey: '',
    imageHostProviders: [
        {
            code: 'imgbb',
            name: 'ImgBB',
            selected: false,
            url: 'https://api.imgbb.com/1/upload?key=',
            apiKey: undefined,
        },
    ],
    trackers: [
        {
            name: 'FearNoPeer',
            code: 'FNP',
            url: 'https://fearnopeer.com',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'Upload.cx',
            code: 'ULCX',
            url: 'https://upload.cx',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'ReelFliX',
            code: 'RFX',
            url: 'https://reelflix.cc',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'Hawke-uno',
            code: 'HUNO',
            url: 'https://hawke.uno',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'Seedpool',
            code: 'SP',
            url: 'https://seedpool.org',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'LST',
            code: 'LST',
            url: 'https://lst.gg',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
        {
            name: 'Aither',
            code: 'ATH',
            url: 'https://aither.cc',
            selected: false,
            apiKey: undefined,
            passKey: undefined,
        },
    ],
    mediainfoPath: 'mediainfo',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    movieScreenshotCount: 6,
    tvEpisodeScreenshotCount: 1,
}

export async function getSettings() {
    const settings = await settingsCollection.findOneAsync({ id: DEFAULT_SETTINGS.id } as Settings | Record<string, unknown>)

    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        imageHostProviders: mergeImageHostProviders(settings?.imageHostProviders),
        trackers: mergeTrackers(settings?.trackers),
    }
}

export async function saveSettings(settingsInput: Omit<Settings, 'id'>) {
    const settings = {
        id: DEFAULT_SETTINGS.id,
        mediaPaths: settingsInput.mediaPaths,
        tmdbApiKey: settingsInput.tmdbApiKey,
        imageHostProviders: settingsInput.imageHostProviders.map((provider) => ({
            code: provider.code,
            selected: provider.selected,
            apiKey: provider.apiKey,
        })),
        trackers: settingsInput.trackers.map((tracker) => ({
            code: tracker.code,
            selected: tracker.selected,
            apiKey: tracker.apiKey,
            passKey: tracker.passKey,
        })),
        mediainfoPath: settingsInput.mediainfoPath,
        ffmpegPath: settingsInput.ffmpegPath,
        ffprobePath: settingsInput.ffprobePath,
        movieScreenshotCount: settingsInput.movieScreenshotCount,
        tvEpisodeScreenshotCount: settingsInput.tvEpisodeScreenshotCount,
    }

    await settingsCollection.updateAsync({ id: DEFAULT_SETTINGS.id }, settings, { upsert: true })
}

function mergeImageHostProviders(input: unknown): Settings['imageHostProviders'] {
    if (!Array.isArray(input)) {
        return DEFAULT_SETTINGS.imageHostProviders
    }

    const savedProvidersByCode = Object.fromEntries(input.map((provider) => [provider.code, provider]))

    return DEFAULT_SETTINGS.imageHostProviders.map((provider) => {
        return {
            ...provider,
            ...savedProvidersByCode[provider.code],
        }
    })
}

function mergeTrackers(input: unknown): Settings['trackers'] {
    if (!Array.isArray(input)) {
        return DEFAULT_SETTINGS.trackers
    }

    const savedTrackersByCode = Object.fromEntries(input.map((tracker) => [tracker.code, tracker]))

    return DEFAULT_SETTINGS.trackers.map((tracker) => {
        return {
            ...tracker,
            ...savedTrackersByCode[tracker.code],
        }
    })
}
