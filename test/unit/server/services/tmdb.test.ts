import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSettings = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

async function loadTMDbService() {
    vi.doMock('../../../../server/repositories/settings-repository', () => ({ getSettings }))
    return import('../../../../server/services/tmdb')
}

describe('tmdb service', () => {
    it('requires api key from settings', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: '   ' })
        const { findByTitle, TMDB_API_KEY_REQUIRED_ERROR } = await loadTMDbService()

        await expect(findByTitle('abc', 'movie')).rejects.toThrowError(TMDB_API_KEY_REQUIRED_ERROR)
    })

    it('finds by title for requested media type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        const fetchMock = vi.fn().mockResolvedValue({
            results: [{ id: 1, media_type: 'movie', title: 'Movie', original_title: 'Movie Original', original_language: 'en', release_date: '2024-01-01' }],
        })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByTitle('Movie', 'movie')).resolves.toEqual({
            id: 1,
            title: 'Movie',
            original_title: 'Movie Original',
            original_language: 'en',
            year: 2024,
            media_type: 'movie',
        })
    })

    it('returns empty result when title is blank', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByTitle('   ', 'movie')).resolves.toEqual({})
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('finds by external id and normalizes prefixed id', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()

        const fetchMock = vi.fn().mockResolvedValue({ tv_results: [{ id: 99, name: 'Show', original_name: 'Show O', original_language: 'en', first_air_date: '2020-01-01' }] })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByExternalID('tv/tt123', ID_TYPES.IMDB, 'tv')).resolves.toMatchObject({ id: 99, title: 'Show', year: 2020, media_type: 'tv' })
    })

    it('returns empty result for invalid external id type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByExternalID('tt123', 'bad_id' as never, 'movie')).resolves.toEqual({})
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns empty result when external id is blank', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByExternalID('   ', ID_TYPES.IMDB, 'movie')).resolves.toEqual({})
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('gets details and external ids', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails, getExternalIDs } = await loadTMDbService()

        const fetchMock = vi.fn().mockResolvedValueOnce({ id: 88, title: 'Film', release_date: '2019-10-10' }).mockResolvedValueOnce({ imdb_id: 'tt001', tvdb_id: 2 })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getDetails('movie/88', 'movie')).resolves.toMatchObject({ id: 88, title: 'Film', year: 2019 })
        await expect(getExternalIDs('88', 'movie')).resolves.toEqual({ imdb_id: 'tt001', tvdb_id: 2 })
    })

    it('returns empty details and external ids when tmdb id is blank', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails, getExternalIDs } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getDetails('   ', 'movie')).resolves.toEqual({})
        await expect(getExternalIDs('   ', 'movie')).resolves.toEqual({})
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns empty responses when tmdb request fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle, getExternalIDs } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network down')))

        await expect(findByTitle('Movie', 'movie')).resolves.toEqual({})
        await expect(getExternalIDs('1', 'movie')).resolves.toEqual({})
    })

    it('returns empty when external id lookup has no result for requested media type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [{ id: 4, title: 'Movie only', release_date: '2022-01-01' }], tv_results: [] }))

        await expect(findByExternalID('tt123', ID_TYPES.IMDB, 'tv')).resolves.toEqual({})
    })

    it('handles missing tv_results branch for tv external lookup', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [] }))

        await expect(findByExternalID('tt999', ID_TYPES.IMDB, 'tv')).resolves.toEqual({})
    })

    it('returns movie result branch when media type is movie', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [{ id: 7, title: 'Movie Pick', release_date: '2021-03-03' }],
                tv_results: [{ id: 8, name: 'TV Pick', first_air_date: '2021-03-03' }],
            })
        )

        await expect(findByExternalID('tt777', ID_TYPES.IMDB, 'movie')).resolves.toMatchObject({
            id: 7,
            title: 'Movie Pick',
            media_type: 'movie',
        })
    })

    it('handles non-object fetch errors', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue('boom'))

        await expect(findByTitle('Movie', 'movie')).resolves.toEqual({})
    })

    it('sanitizes non-ascii and quoted text and handles invalid year', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    {
                        id: 2,
                        media_type: 'movie',
                        title: '  "Quoted"  ',
                        original_title: 'Nón-ASCII',
                        original_language: 'en',
                        release_date: 'abcd-01-01',
                    },
                ],
            })
        )

        await expect(findByTitle('Quoted', 'movie')).resolves.toEqual({
            id: 2,
            title: 'Quoted',
            original_title: undefined,
            original_language: 'en',
            year: undefined,
            media_type: 'movie',
        })
    })

    it('drops empty normalized titles and short date years', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    {
                        id: 3,
                        media_type: 'movie',
                        title: '" "',
                        original_title: 'Original',
                        original_language: 'en',
                        release_date: '20',
                    },
                ],
            })
        )

        await expect(findByTitle('Something', 'movie')).resolves.toEqual({
            id: 3,
            title: ' ',
            original_title: 'Original',
            original_language: 'en',
            year: undefined,
            media_type: 'movie',
        })
    })

    it('returns undefined title when sanitized title becomes empty after quote trimming', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    {
                        id: 5,
                        media_type: 'movie',
                        title: '""',
                        original_title: 'Original',
                        original_language: 'en',
                        release_date: '2020-01-01',
                    },
                ],
            })
        )

        await expect(findByTitle('Anything', 'movie')).resolves.toEqual({
            id: 5,
            title: undefined,
            original_title: 'Original',
            original_language: 'en',
            year: 2020,
            media_type: 'movie',
        })
    })

    it('returns empty when details payload has no id', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ title: 'No id present' }))

        await expect(getDetails('9', 'movie')).resolves.toEqual({})
    })

    it('returns empty when details request returns null payload', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(null))

        await expect(getDetails('10', 'movie')).resolves.toEqual({})
    })

    it('handles fetch error objects with non-string and non-number fields', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockRejectedValue({
                name: 123,
                message: { text: 'bad' },
                statusCode: '404',
                data: { status_code: 'x', status_message: 999 },
            })
        )

        await expect(findByTitle('Movie', 'movie')).resolves.toEqual({})
    })

    it('handles fetch error objects with typed status fields', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockRejectedValue({
                name: 'FetchError',
                message: 'Not found',
                statusCode: 404,
                data: { status_code: 34, status_message: 'The resource you requested could not be found.' },
            })
        )

        await expect(findByTitle('Movie', 'movie')).resolves.toEqual({})
    })
})
