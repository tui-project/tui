import { readonly } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildMetadata = (): Metadata => ({
    fileName: 'Movie.2024.1080p.mkv',
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'YIFY',
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

describe('useTrackerRules composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('readonly', readonly)
    })

    it('returns violations and keeps loading false when fetch succeeds', async () => {
        const violations = [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }]
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ violations }))

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations, loading, error } = useTrackerRules()

        const result = await getViolations('ULCX', buildMetadata())

        expect(result).toEqual(violations)
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })

    it('calls the correct API endpoint with the tracker code', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ violations: [] })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations } = useTrackerRules()

        await getViolations('ULCX', buildMetadata())

        expect(fetchMock).toHaveBeenCalledWith('/api/tracker/ULCX/rules', expect.objectContaining({ method: 'POST' }))
    })

    it('strips null and empty-string fields from metadata before sending', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ violations: [] })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations } = useTrackerRules()

        await getViolations('ULCX', buildMetadata())

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

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations, loading, error } = useTrackerRules()

        const result = await getViolations('ULCX', buildMetadata())

        expect(result).toEqual([])
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
    })

    it('sets loading to true during fetch and resets after', async () => {
        let resolve: ((v: { violations: [] }) => void) | undefined
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockImplementation(
                () =>
                    new Promise((r) => {
                        resolve = r
                    })
            )
        )

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations, loading } = useTrackerRules()

        const promise = getViolations('ULCX', buildMetadata())
        expect(loading.value).toBe(true)

        resolve?.({ violations: [] })
        await promise
        expect(loading.value).toBe(false)
    })

    it('tracks concurrent fetches correctly via pendingCount', async () => {
        let resolve1: ((v: { violations: [] }) => void) | undefined
        let resolve2: ((v: { violations: [] }) => void) | undefined
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

        const { useTrackerRules } = await import('../../../../app/composables/useTrackerRules')
        const { getViolations, loading } = useTrackerRules()

        const p1 = getViolations('ULCX', buildMetadata())
        const p2 = getViolations('ATH', buildMetadata())
        expect(loading.value).toBe(true)

        resolve1?.({ violations: [] })
        await p1
        expect(loading.value).toBe(true)

        resolve2?.({ violations: [] })
        await p2
        expect(loading.value).toBe(false)
    })
})
