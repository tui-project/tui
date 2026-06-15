import { readonly } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildMetadata = (): Metadata => ({
    fileName: 'Movie.2024.1080p.mkv',
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    year: 2024,
    season: null,
    episode: null,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    service: '',
    repack: 0,
    proper: 0,
    cut: '',
    hybrid: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    audioMetadata: '',
    tmdbId: 1,
    imdbId: 'tt1234567',
    tvdbId: null,
})

describe('useTrackerTitle composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('readonly', readonly)
    })

    it('returns a title and keeps loading false when fetch succeeds', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle, loading, error } = useTrackerTitle()

        const result = await getTitle('ULCX', buildMetadata())

        expect(result).toBe('Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP')
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })

    it('calls the correct API endpoint with tracker code', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ title: 'Some Title' })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle } = useTrackerTitle()

        await getTitle('ATH', buildMetadata())

        expect(fetchMock).toHaveBeenCalledWith('/api/tracker/ATH/title', expect.objectContaining({ method: 'POST' }))
    })

    it('strips null and empty-string fields from metadata before sending', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ title: 'Title' })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle } = useTrackerTitle()

        const metadata = buildMetadata()
        await getTitle('ULCX', metadata)

        const body = fetchMock.mock.calls[0][1].body
        expect(body.metadata).not.toHaveProperty('service')
        expect(body.metadata).not.toHaveProperty('cut')
        expect(body.metadata).not.toHaveProperty('audioMetadata')
        expect(body.metadata).not.toHaveProperty('season')
        expect(body.metadata).not.toHaveProperty('episode')
        expect(body.metadata).not.toHaveProperty('tvdbId')
    })

    it('returns null and sets error flag when fetch fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle, loading, error } = useTrackerTitle()

        const result = await getTitle('ULCX', buildMetadata())

        expect(result).toBeUndefined()
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
    })

    it('sets loading to true during fetch and resets after', async () => {
        let resolveTitle: ((v: { title: string }) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<{ title: string }>((r) => {
                    resolveTitle = r
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle, loading } = useTrackerTitle()

        const promise = getTitle('ULCX', buildMetadata())
        expect(loading.value).toBe(true)

        resolveTitle?.({ title: 'Done' })
        await promise
        expect(loading.value).toBe(false)
    })

    it('tracks concurrent fetches correctly via pendingCount', async () => {
        let resolve1: ((v: { title: string }) => void) | undefined
        let resolve2: ((v: { title: string }) => void) | undefined
        const fetchMock = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<{ title: string }>((r) => {
                        resolve1 = r
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise<{ title: string }>((r) => {
                        resolve2 = r
                    })
            )
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerTitle } = await import('../../../../app/composables/useTrackerTitle')
        const { getTitle, loading } = useTrackerTitle()

        const p1 = getTitle('ULCX', buildMetadata())
        const p2 = getTitle('ATH', buildMetadata())
        expect(loading.value).toBe(true)

        resolve1?.({ title: 'T1' })
        await p1
        expect(loading.value).toBe(true)

        resolve2?.({ title: 'T2' })
        await p2
        expect(loading.value).toBe(false)
    })
})
