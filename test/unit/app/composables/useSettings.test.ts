import { beforeEach, describe, expect, it, vi } from 'vitest'

function buildSettings(
    overrides: Partial<{
        mediaPaths: string[]
        tmdbApiKey: string
        imageHostProviders: Record<string, { selected: boolean; code: string; name: string; apiKey: string | null }>
        trackers: Record<string, { selected: boolean; code: string; name: string; url: string; apiKey: string | null; passKey: string | null }>
        ffmpegPath: string
        ffprobePath: string
        movieScreenshotCount: number
        episodePackScreenshotCount: number
    }> = {}
) {
    return {
        mediaPaths: ['/media/a'],
        tmdbApiKey: '',
        imageHostProviders: {
            imgbb: { selected: false, code: 'imgbb', name: 'ImgBB', apiKey: null },
        },
        trackers: {
            ULCX: { selected: false, code: 'ULCX', name: 'Upload.cx', url: 'https://upload.cx', apiKey: null, passKey: null },
        },
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        ...overrides,
    }
}

describe('useSettings composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('loads settings successfully', async () => {
        const settings = buildSettings()
        const fetchMock = vi.fn().mockResolvedValue(settings)
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { getSettings, loading, loadError } = useSettings()
        const result = await getSettings()

        expect(fetchMock).toHaveBeenCalledWith('/api/settings')
        expect(result).toEqual(settings)
        expect(loading.value).toBe(false)
        expect(loadError.value).toBe(false)
    })

    it('returns null and sets loadError when loading settings fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { getSettings, loading, loadError } = useSettings()
        const result = await getSettings()

        expect(result).toBeNull()
        expect(loading.value).toBe(false)
        expect(loadError.value).toBe(true)
    })

    it('saves settings successfully', async () => {
        const settings = buildSettings({
            mediaPaths: ['/media/a', '/media/b'],
            tmdbApiKey: 'abc',
            ffmpegPath: '/usr/local/bin/ffmpeg',
            ffprobePath: '/usr/local/bin/ffprobe',
        })
        const fetchMock = vi.fn().mockResolvedValue(settings)
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { saveSettings, loading, saveError } = useSettings()
        const result = await saveSettings(settings)

        expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
            method: 'POST',
            body: settings,
        })
        expect(result).toEqual(settings)
        expect(loading.value).toBe(false)
        expect(saveError.value).toBeNull()
    })

    it('returns null and sets saveError message when saving settings fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue({ data: { message: 'Media path does not exist: /missing' } })
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { saveSettings, loading, saveError } = useSettings()
        const result = await saveSettings(buildSettings())

        expect(result).toBeNull()
        expect(loading.value).toBe(false)
        expect(saveError.value).toBe('Media path does not exist: /missing')
    })

    it('sets fallback saveError message when API error has no message', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { saveSettings, saveError } = useSettings()
        await saveSettings(buildSettings())

        expect(saveError.value).toBe('An unexpected error occurred.')
    })

    it('does not call fetch when already loading', async () => {
        let resolveFetch: ((value: ReturnType<typeof buildSettings>) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<ReturnType<typeof buildSettings>>((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { getSettings, loading } = useSettings()
        const pending = getSettings()

        expect(loading.value).toBe(true)
        await expect(getSettings()).resolves.toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.(buildSettings())
        await pending
        expect(loading.value).toBe(false)
    })

    it('does not call save fetch when already loading', async () => {
        let resolveFetch: ((value: ReturnType<typeof buildSettings>) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<ReturnType<typeof buildSettings>>((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useSettings } = await import('../../../../app/composables/useSettings')
        const { saveSettings, loading } = useSettings()
        const pending = saveSettings(buildSettings())

        expect(loading.value).toBe(true)
        await expect(saveSettings(buildSettings({ mediaPaths: ['/media/b'] }))).resolves.toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.(buildSettings())
        await pending
        expect(loading.value).toBe(false)
    })
})
