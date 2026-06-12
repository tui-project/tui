import { readonly } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from '../../../../app/components/upload/upload.types'

const buildMetadata = (): Metadata => ({
    fileName: 'Movie.2024.1080p.mkv',
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    year: 2024,
    season: null,
    episode: null,
    episodeEnd: null,
    specialName: '',
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    service: '',
    repack: 0,
    proper: 0,
    rerip: 0,
    cut: '',
    ratio: '',
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
    tvdbId: null,
    locale: '',
})

describe('useTrackerDuplicates composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('readonly', readonly)
    })

    it('returns duplicates and keeps loading false when fetch succeeds', async () => {
        const duplicates = [{ name: 'Movie.2024.1080p.BluRay.ENCODE.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }]
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ duplicates }))

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates, loading, error } = useTrackerDuplicates()

        const result = await getDuplicates('ATH', buildMetadata())

        expect(result).toEqual(duplicates)
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })

    it('calls the correct API endpoint with the tracker code', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ duplicates: [] })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates } = useTrackerDuplicates()

        await getDuplicates('ATH', buildMetadata())

        expect(fetchMock).toHaveBeenCalledWith('/api/tracker/ATH/duplicates', expect.objectContaining({ method: 'POST' }))
    })

    it('strips null and empty-string fields from metadata before sending', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ duplicates: [] })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates } = useTrackerDuplicates()

        await getDuplicates('ATH', buildMetadata())

        const body = fetchMock.mock.calls[0][1].body
        expect(body.metadata).not.toHaveProperty('service')
        expect(body.metadata).not.toHaveProperty('cut')
        expect(body.metadata).not.toHaveProperty('audioMetadata')
        expect(body.metadata).not.toHaveProperty('season')
        expect(body.metadata).not.toHaveProperty('episode')
        expect(body.metadata).not.toHaveProperty('tvdbId')
    })

    it('returns empty array and sets error flag when fetch fails', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates, loading, error } = useTrackerDuplicates()

        const result = await getDuplicates('ATH', buildMetadata())

        expect(result).toEqual([])
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
    })

    it('sets loading to true during fetch and resets after', async () => {
        let resolve: ((v: { duplicates: [] }) => void) | undefined
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockImplementation(
                () =>
                    new Promise((r) => {
                        resolve = r
                    })
            )
        )

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates, loading } = useTrackerDuplicates()

        const promise = getDuplicates('ATH', buildMetadata())
        expect(loading.value).toBe(true)

        resolve?.({ duplicates: [] })
        await promise
        expect(loading.value).toBe(false)
    })

    it('tracks concurrent fetches correctly via pendingCount', async () => {
        let resolve1: ((v: { duplicates: [] }) => void) | undefined
        let resolve2: ((v: { duplicates: [] }) => void) | undefined
        vi.stubGlobal(
            '$fetch',
            vi
                .fn()
                .mockImplementationOnce(
                    () =>
                        new Promise((r) => {
                            resolve1 = r
                        })
                )
                .mockImplementationOnce(
                    () =>
                        new Promise((r) => {
                            resolve2 = r
                        })
                )
        )

        const { useTrackerDuplicates } = await import('../../../../app/composables/useTrackerDuplicates')
        const { getDuplicates, loading } = useTrackerDuplicates()

        const p1 = getDuplicates('ATH', buildMetadata())
        const p2 = getDuplicates('ULCX', buildMetadata())
        expect(loading.value).toBe(true)

        resolve1?.({ duplicates: [] })
        await p1
        expect(loading.value).toBe(true)

        resolve2?.({ duplicates: [] })
        await p2
        expect(loading.value).toBe(false)
    })
})
