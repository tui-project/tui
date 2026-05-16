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
        const { findByTitle } = await loadTMDbService()

        await expect(findByTitle('abc', 'movie')).rejects.toThrow('tmdb api key is required')
    })

    it('finds by title for requested media type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    {
                        id: 1,
                        media_type: 'movie',
                        title: 'Movie',
                        original_title: 'Movie Original',
                        original_language: 'en',
                        release_date: '2024-01-01',
                        origin_country: ['US'],
                    },
                ],
            })
        )

        await expect(findByTitle('Movie', 'movie')).resolves.toMatchObject({
            id: 1,
            title: 'Movie',
            original_title: 'Movie Original',
            original_language: 'en',
            year: 2024,
            media_type: 'movie',
            origin_country: 'US',
        })
    })

    it('returns null when title is blank', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByTitle('   ', 'movie')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns null when no matching results for media type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({ results: [{ id: 1, media_type: 'tv', name: 'Show', original_language: 'en', first_air_date: '2020-01-01', origin_country: ['US'] }] })
        )

        await expect(findByTitle('Show', 'movie')).resolves.toBeNull()
    })

    it('returns null when fetch fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network down')))

        await expect(findByTitle('Movie', 'movie')).resolves.toBeNull()
    })

    it('returns no locale for movie when same-year duplicate exists but match is first result', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 1, media_type: 'movie', title: 'Funny Games', original_language: 'de', release_date: '2007-01-01', origin_country: ['AT'] },
                    { id: 2, media_type: 'movie', title: 'Funny Games', original_language: 'en', release_date: '2007-01-01', origin_country: ['US'] },
                ],
            })
        )

        await expect(findByTitle('Funny Games', 'movie')).resolves.toMatchObject({ id: 1, origin_country: 'AT' })
    })

    it('returns locale for tv duplicate when match is not earliest', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 10, media_type: 'tv', name: 'The Office', original_language: 'en', first_air_date: '2005-03-24', origin_country: ['US'] },
                    { id: 9, media_type: 'tv', name: 'The Office', original_language: 'en', first_air_date: '2001-07-09', origin_country: ['GB'] },
                ],
            })
        )

        await expect(findByTitle('The Office', 'tv')).resolves.toMatchObject({ id: 10, origin_country: 'US' })
    })

    it('finds by external id and normalizes prefixed id', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [],
                tv_results: [
                    {
                        id: 99,
                        name: 'Show',
                        original_name: 'Show O',
                        original_language: 'en',
                        first_air_date: '2020-01-01',
                        origin_country: [],
                        external_ids: { imdb_id: 'tt123' },
                    },
                ],
            })
        )

        await expect(findByExternalID('tv/tt123', ID_TYPES.IMDB, 'tv')).resolves.toMatchObject({ id: 99, title: 'Show', year: 2020, media_type: 'tv' })
    })

    it('returns external ids from find response when present', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [{ id: 5, title: 'Film', release_date: '2020-01-01', origin_country: [], external_ids: { imdb_id: 'tt999', tvdb_id: null } }],
                tv_results: [],
            })
        )

        await expect(findByExternalID('tt999', ID_TYPES.IMDB, 'movie')).resolves.toMatchObject({
            external_ids: { imdb_id: 'tt999' },
        })
    })

    it('returns null when find response item has no external_ids', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [{ id: 5, title: 'Film', release_date: '2020-01-01', origin_country: [] }],
                tv_results: [],
            })
        )

        await expect(findByExternalID('tt888', ID_TYPES.IMDB, 'movie')).resolves.toBeNull()
    })

    it('returns null for invalid external id type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByExternalID('tt123', 'bad_id' as never, 'movie')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns null when external id is blank', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(findByExternalID('   ', ID_TYPES.IMDB, 'movie')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns null when external id lookup has no result for requested media type', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [{ id: 4, title: 'Movie only', release_date: '2022-01-01', origin_country: [] }], tv_results: [] }))

        await expect(findByExternalID('tt123', ID_TYPES.IMDB, 'tv')).resolves.toBeNull()
    })

    it('returns null when tv_results is empty for tv external lookup', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [], tv_results: [] }))

        await expect(findByExternalID('tt999', ID_TYPES.IMDB, 'tv')).resolves.toBeNull()
    })

    it('returns null when movie_results is empty for movie external lookup', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [], tv_results: [] }))

        await expect(findByExternalID('tt999', ID_TYPES.IMDB, 'movie')).resolves.toBeNull()
    })

    it('returns movie result branch when media type is movie', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [{ id: 7, title: 'Movie Pick', release_date: '2021-03-03', origin_country: [], external_ids: { imdb_id: 'tt777' } }],
                tv_results: [{ id: 8, name: 'TV Pick', first_air_date: '2021-03-03', origin_country: [], external_ids: { imdb_id: 'tt777' } }],
            })
        )

        await expect(findByExternalID('tt777', ID_TYPES.IMDB, 'movie')).resolves.toMatchObject({
            id: 7,
            title: 'Movie Pick',
            media_type: 'movie',
        })
    })

    it('returns tvdb_id from external_ids when present on selected item', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                movie_results: [],
                tv_results: [{ id: 5, name: 'Show', first_air_date: '2020-01-01', origin_country: [], external_ids: { imdb_id: undefined, tvdb_id: 300 } }],
            })
        )

        const result = await findByExternalID('300', ID_TYPES.TVDB, 'tv')
        expect(result?.external_ids?.tvdb_id).toBe(300)
        expect(result?.external_ids?.imdb_id).toBeUndefined()
    })

    it('gets details with external ids via append_to_response', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()

        const fetchMock = vi.fn().mockResolvedValue({
            id: 88,
            title: 'Film',
            release_date: '2019-10-10',
            original_language: 'en',
            origin_country: ['US'],
            external_ids: { imdb_id: 'tt001', tvdb_id: 2 },
        })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getDetails('movie/88', 'movie')).resolves.toMatchObject({ id: 88, title: 'Film', year: 2019, external_ids: { imdb_id: 'tt001', tvdb_id: 2 } })
    })

    it('returns null when details request fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        await expect(getDetails('9', 'movie')).resolves.toBeNull()
    })

    it('returns null when tmdb id is blank for getDetails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getDetails('   ', 'movie')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns null when tmdb id is blank for getExternalIDs', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getExternalIDs } = await loadTMDbService()
        const fetchMock = vi.fn()
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getExternalIDs('   ', 'movie')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns external ids object from getExternalIDs', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getExternalIDs } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ imdb_id: 'tt001', tvdb_id: 2 }))

        await expect(getExternalIDs('88', 'movie')).resolves.toEqual({ imdb_id: 'tt001', tvdb_id: 2 })
    })

    it('returns null when getExternalIDs request fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getExternalIDs } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        await expect(getExternalIDs('1', 'movie')).resolves.toBeNull()
    })

    it('findLocale returns locale for matching tmdbId when not earliest', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 2, media_type: 'tv', name: 'The Office', first_air_date: '2005-03-24', origin_country: ['US'] },
                    { id: 1, media_type: 'tv', name: 'The Office', first_air_date: '2001-07-09', origin_country: ['GB'] },
                ],
            })
        )

        await expect(findLocale('The Office', 2, 'tv')).resolves.toBe('US')
    })

    it('findLocale returns undefined for earliest tmdbId', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 2, media_type: 'tv', name: 'The Office', first_air_date: '2005-03-24', origin_country: ['US'] },
                    { id: 1, media_type: 'tv', name: 'The Office', first_air_date: '2001-07-09', origin_country: ['GB'] },
                ],
            })
        )

        await expect(findLocale('The Office', 1, 'tv')).resolves.toBeUndefined()
    })

    it('findLocale returns undefined when tmdbId not found in results', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ results: [{ id: 99, media_type: 'tv', name: 'Other Show', first_air_date: '2020-01-01', origin_country: ['US'] }] }))

        await expect(findLocale('The Office', 2, 'tv')).resolves.toBeUndefined()
    })

    it('findLocale returns undefined when fetch fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        await expect(findLocale('The Office', 2, 'tv')).resolves.toBeUndefined()
    })

    it('findLocale detects movie duplicate and returns locale when not first in results', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 1, media_type: 'movie', title: 'Funny Games', release_date: '2007-01-01', origin_country: ['AT'] },
                    { id: 2, media_type: 'movie', title: 'Funny Games', release_date: '2007-01-01', origin_country: ['US'] },
                ],
            })
        )

        await expect(findLocale('Funny Games', 2, 'movie')).resolves.toBe('US')
    })

    it('findLocale excludes movie duplicate with different year from consideration', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 2, media_type: 'movie', title: 'Funny Games', release_date: '2007-05-22', origin_country: ['US'] },
                    { id: 3, media_type: 'movie', title: 'Funny Games', release_date: '1997-01-01', origin_country: ['DE'] },
                ],
            })
        )

        await expect(findLocale('Funny Games', 2, 'movie')).resolves.toBeUndefined()
    })

    it('sanitises title that reduces to empty string after quote stripping', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [{ id: 4, media_type: 'movie', title: '""', original_title: 'Original', original_language: 'en', release_date: '2020-01-01', origin_country: [] }],
            })
        )

        await expect(findByTitle('Something', 'movie')).resolves.toMatchObject({
            id: 4,
            title: undefined,
            original_title: 'Original',
        })
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
                        origin_country: [],
                    },
                ],
            })
        )

        await expect(findByTitle('Quoted', 'movie')).resolves.toMatchObject({
            id: 2,
            title: 'Quoted',
            original_title: undefined,
            original_language: 'en',
            year: undefined,
            media_type: 'movie',
        })
    })

    it('detectLocale movie duplicate filter excludes items with different year', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 2, media_type: 'movie', title: 'Funny Games', original_language: 'en', release_date: '2007-05-22', origin_country: ['US'] },
                    { id: 3, media_type: 'movie', title: 'Funny Games', original_language: 'de', release_date: '2005-01-01', origin_country: ['AT'] },
                ],
            })
        )

        await expect(findByTitle('Funny Games', 'movie')).resolves.toMatchObject({ id: 2, origin_country: 'US' })
    })

    it('detectLocale picks earlier result when second item has smaller year', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 20, media_type: 'tv', name: 'Shameless', first_air_date: '2011-01-09', origin_country: ['US'] },
                    { id: 19, media_type: 'tv', name: 'Shameless', first_air_date: '2004-01-13', origin_country: ['GB'] },
                ],
            })
        )

        await expect(findByTitle('Shameless', 'tv')).resolves.toMatchObject({ id: 20, origin_country: 'US' })
    })

    it('detectLocale returns undefined when only one result matches title', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 1, media_type: 'movie', title: 'Funny Games', original_language: 'de', release_date: '1997-01-01', origin_country: ['AT'] },
                    { id: 2, media_type: 'movie', title: 'Different Title', original_language: 'en', release_date: '1997-01-01', origin_country: ['US'] },
                ],
            })
        )

        await expect(findByTitle('Funny Games', 'movie')).resolves.toMatchObject({ id: 1, origin_country: 'AT' })
    })

    it('detectLocale returns undefined locale when one item has undefined year (NaN sort keeps match as first)', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 10, media_type: 'tv', name: 'Show', first_air_date: '2005-01-01', origin_country: ['US'] },
                    { id: 9, media_type: 'tv', name: 'Show', origin_country: ['GB'] },
                ],
            })
        )

        // id 9 has year=undefined → NaN sort; stable sort keeps id:10 first → it IS the earliest → no locale
        await expect(findByTitle('Show', 'tv')).resolves.toMatchObject({ id: 10, origin_country: undefined })
    })
})
