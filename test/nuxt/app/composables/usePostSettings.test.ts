import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../../../app/composables/useGetSettings'

const fetchMock = vi.fn()

function buildSettings(overrides: Partial<AppSettings> = {}): AppSettings {
    return {
        mediaPaths: ['/media/a'],
        tmdbApiKey: '',
        imageHostProviders: [],
        trackers: [],
        torrentClients: [],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        logLevel: 3,
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue(buildSettings())
})

function makeWrapper(initial = buildSettings()) {
    const body = ref<AppSettings | undefined>(initial)
    let composable: ReturnType<typeof usePostSettings>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostSettings(body)
        },
        template: '<div />',
    })
    return { Wrapper, body, getComposable: () => composable }
}

describe('usePostSettings', () => {
    it('does not fetch on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts to /api/settings with the configured ref value when execute is called', async () => {
        const settings = buildSettings({ tmdbApiKey: 'abc' })
        const { Wrapper, getComposable } = makeWrapper(settings)
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({ method: 'POST', body: settings }))
    })

    it('populates data after execute resolves', async () => {
        const response = buildSettings({ tmdbApiKey: 'saved' })
        fetchMock.mockResolvedValue(response)

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().data.value).toEqual(response)
    })

    it('errorMessage is empty after a successful execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().errorMessage.value).toBe('')
    })

    it('errorMessage uses the API message when fetch throws with a message', async () => {
        fetchMock.mockRejectedValue({ data: { message: 'Media path does not exist: /missing' } })

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().errorMessage.value).toBe('Media path does not exist: /missing')
    })

    it('errorMessage falls back to generic message when fetch throws without a message', async () => {
        fetchMock.mockRejectedValue(new Error('network'))

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().errorMessage.value).toBe('An unexpected error occurred.')
    })

    it('pending is false before and after execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
        await getComposable().execute()
        expect(getComposable().pending.value).toBe(false)
    })
})
