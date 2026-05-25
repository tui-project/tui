import { readonly, ref } from 'vue'

export type ImageHostProvider = 'imgbb'
export interface ImageHostProviderSettings {
    selected: boolean
    code: string
    name: string
    apiKey?: string
}

export interface TrackerSettings {
    selected: boolean
    code: string
    name: string
    apiKey?: string
    passKey?: string
}

export interface TorrentClientSettings {
    selected: boolean
    code: string
    name: string
    url: string
    apiKey: string
}

export interface AppSettings {
    mediaPaths: string[]
    tmdbApiKey: string
    imageHostProviders: ImageHostProviderSettings[]
    trackers: TrackerSettings[]
    torrentClients: TorrentClientSettings[]
    mediainfoPath: string
    ffmpegPath: string
    ffprobePath: string
    movieScreenshotCount: number
    episodePackScreenshotCount: number
    logLevel: number
}

export function useSettings() {
    const loading = ref(false)
    const loadError = ref(false)
    const saveError = ref<string | null>(null)

    async function getSettings() {
        if (loading.value) {
            return null
        }

        loading.value = true
        loadError.value = false

        try {
            return await $fetch<AppSettings>('/api/settings')
        } catch {
            loadError.value = true
            return null
        } finally {
            loading.value = false
        }
    }

    async function saveSettings(settings: AppSettings) {
        if (loading.value) {
            return null
        }

        loading.value = true
        saveError.value = null

        try {
            return await $fetch<AppSettings>('/api/settings', {
                method: 'POST',
                body: settings,
            })
        } catch (err: unknown) {
            const message = (err as { data?: { message?: string } })?.data?.message ?? null
            saveError.value = message ?? 'An unexpected error occurred.'
            return null
        } finally {
            loading.value = false
        }
    }

    return {
        getSettings,
        saveSettings,
        loading: readonly(loading),
        loadError: readonly(loadError),
        saveError: readonly(saveError),
    }
}
