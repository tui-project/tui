import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue({ title: 'Movie 2024 1080p BluRay H.264-GROUP' })
})

const metadata: Metadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    year: 2024,
    season: undefined,
    episode: undefined,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    service: '',
    repack: 0,
    proper: 0,
    rerip: 0,
    cut: '',
    hybrid: false,
    hi10p: false,
    hasEnglishSubs: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    audioMetadata: '',
    tmdbId: 1,
    imdbId: 'tt1234567',
    tvdbId: undefined,
}

function makeWrapper(trackerCode = 'ULCX') {
    const codeRef = ref(trackerCode)
    let composable: ReturnType<typeof usePostTrackerTitle>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostTrackerTitle(codeRef, metadata)
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostTrackerTitle', () => {
    it('does not fetch on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts to /api/tracker/{code}/title with the configured refs when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper('ATH')
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(fetchMock).toHaveBeenCalledWith('/api/tracker/ATH/title', expect.objectContaining({ method: 'POST' }))
    })

    it('populates data after execute resolves', async () => {
        const response = { title: 'Movie 2024 1080p BluRay H.264-GROUP' }
        fetchMock.mockResolvedValue(response)

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().data.value).toEqual(response)
    })

    it('sets error when fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().error.value).toBeDefined()
    })

    it('pending is false before and after execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
        await getComposable().execute()
        expect(getComposable().pending.value).toBe(false)
    })
})
