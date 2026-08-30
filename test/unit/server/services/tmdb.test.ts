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

    it.each(['movie', 'tv'] as const)('returns null when %s external lookup has no result', async (mediaType) => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ movie_results: [], tv_results: [] }))

        await expect(findByExternalID('tt999', ID_TYPES.IMDB, mediaType)).resolves.toBeNull()
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

    it('returns null when findByExternalID fetch fails', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByExternalID, ID_TYPES } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        await expect(findByExternalID('tt123', ID_TYPES.IMDB, 'movie')).resolves.toBeNull()
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

    it('gets movie details with external ids and normalized alternative titles', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()

        const fetchMock = vi.fn().mockResolvedValue({
            id: 88,
            title: 'Film',
            release_date: '2019-10-10',
            original_language: 'en',
            origin_country: ['US'],
            external_ids: { imdb_id: 'tt001', tvdb_id: 2 },
            alternative_titles: { titles: [{ iso_3166_1: 'US', title: 'Film Alt', type: '' }] },
        })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getDetails('movie/88', 'movie')).resolves.toMatchObject({
            id: 88,
            title: 'Film',
            year: 2019,
            external_ids: { imdb_id: 'tt001', tvdb_id: 2 },
            alternative_titles: [{ iso_3166_1: 'US', title: 'Film Alt', type: '' }],
        })
        expect(fetchMock).toHaveBeenCalledWith('https://api.themoviedb.org/3/movie/88', {
            query: { api_key: 'key', append_to_response: 'external_ids,alternative_titles' },
        })
    })

    it('normalizes alternative titles from TV details results', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { getDetails } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                id: 89,
                name: 'Show',
                first_air_date: '2020-01-01',
                original_language: 'zh',
                external_ids: {},
                alternative_titles: { results: [{ iso_3166_1: 'CN', title: 'Shou', type: 'romanized' }] },
            })
        )

        await expect(getDetails('89', 'tv')).resolves.toMatchObject({
            alternative_titles: [{ iso_3166_1: 'CN', title: 'Shou', type: 'romanized' }],
        })
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

    it.each([
        { tmdbId: 2, expected: 'US' },
        { tmdbId: 1, expected: undefined },
    ])('findLocale returns $expected for tmdb id $tmdbId', async ({ tmdbId, expected }) => {
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

        await expect(findLocale('The Office', tmdbId, 'tv')).resolves.toBe(expected)
    })

    it('findLocale returns undefined when duplicates are from the same country', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findLocale } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    { id: 2, media_type: 'tv', name: 'The Office', first_air_date: '2005-03-24', origin_country: ['US'] },
                    { id: 1, media_type: 'tv', name: 'The Office', first_air_date: '2001-07-09', origin_country: ['US'] },
                ],
            })
        )

        await expect(findLocale('The Office', 2, 'tv')).resolves.toBeUndefined()
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

    it('sanitizes non-latin script and quoted text and handles invalid year', async () => {
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
                        original_title: 'Плохой фильм',
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

    it('keeps latin-script accented characters in sanitized text', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [
                    {
                        id: 3,
                        media_type: 'movie',
                        title: 'Lust och fägring stor',
                        original_title: 'Lust och fägring stor',
                        original_language: 'sv',
                        release_date: '1995-01-01',
                        origin_country: [],
                    },
                ],
            })
        )

        await expect(findByTitle('Lust och fägring stor', 'movie')).resolves.toMatchObject({
            id: 3,
            title: 'Lust och fägring stor',
            original_title: 'Lust och fägring stor',
            original_language: 'sv',
        })
    })

    it('returns an undefined year when the result has no date', async () => {
        getSettings.mockResolvedValue({ tmdbApiKey: 'key' })
        const { findByTitle } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                results: [{ id: 9, media_type: 'tv', name: 'Show', origin_country: ['GB'] }],
            })
        )

        await expect(findByTitle('Show', 'tv')).resolves.toMatchObject({ id: 9, year: undefined })
    })
})

describe('tmdb service — getLogo', () => {
    beforeEach(() => getSettings.mockResolvedValue({ tmdbApiKey: 'key' }))

    it('prefers the first US English logo over an original-language logo', async () => {
        const { getLogo } = await loadTMDbService()
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                logos: [
                    { iso_3166_1: 'JP', iso_639_1: 'ja', file_path: '/japanese.png' },
                    { iso_3166_1: 'US', iso_639_1: 'en', file_path: '/english.png' },
                    { iso_3166_1: 'US', iso_639_1: 'en', file_path: '/second.png' },
                ],
            })
        )

        await expect(getLogo(10, 'movie', 'ja')).resolves.toBe('https://image.tmdb.org/t/p/original/english.png')
    })

    it('falls back to the first logo matching the original language', async () => {
        const { getLogo } = await loadTMDbService()
        const fetchMock = vi.fn().mockResolvedValue({
            logos: [
                { iso_3166_1: 'GB', iso_639_1: 'en', file_path: '/gb.png' },
                { iso_3166_1: 'FR', iso_639_1: 'fr', file_path: '/french.png' },
            ],
        })
        vi.stubGlobal('$fetch', fetchMock)

        await expect(getLogo(20, 'tv', 'fr')).resolves.toBe('https://image.tmdb.org/t/p/original/french.png')
        expect(fetchMock).toHaveBeenCalledWith('https://api.themoviedb.org/3/tv/20/images', { query: { api_key: 'key' } })
    })

    it('returns null when no logo matches either rule', async () => {
        const { getLogo } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ logos: [{ iso_3166_1: null, iso_639_1: null, file_path: '/neutral.png' }] }))

        await expect(getLogo(30, 'movie', 'de')).resolves.toBeNull()
    })

    it('returns null when the images request fails', async () => {
        const { getLogo } = await loadTMDbService()
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network error')))

        await expect(getLogo(30, 'movie', 'de')).resolves.toBeNull()
    })
})
