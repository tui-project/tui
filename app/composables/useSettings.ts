import { readonly, ref } from 'vue'

export interface AppSettings {
    mediaPaths: string[]
    tmdbApiKey: string
    ffmpegPath: string
    ffprobePath: string
    movieScreenshotCount: number
    tvEpisodeScreenshotCount: number
    imgbbApiKey: string
}

export function useSettings() {
    const loading = ref(false)
    const error = ref(false)

    async function getSettings() {
        if (loading.value) {
            return null
        }

        loading.value = true
        error.value = false

        try {
            return await $fetch<AppSettings>('/api/settings')
        } catch {
            error.value = true
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
        error.value = false

        try {
            return await $fetch<AppSettings>('/api/settings', {
                method: 'POST',
                body: settings,
            })
        } catch {
            error.value = true
            return null
        } finally {
            loading.value = false
        }
    }

    return {
        getSettings,
        saveSettings,
        loading: readonly(loading),
        error: readonly(error),
    }
}
