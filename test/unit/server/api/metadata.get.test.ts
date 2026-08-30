import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
}
const getQuery = vi.fn<() => { path?: string }>()
const createError = vi.fn((payload: unknown) => payload)
const getSettings = vi.fn<() => Promise<{ id: string; mediaPaths: string[] }>>()
const parseMetadataFromMediainfo = vi.fn<() => Promise<unknown>>()
const getDetails = vi.fn()
const findByExternalID = vi.fn()
const findByTitle = vi.fn()
const findLocale = vi.fn()
const findTvdbSpecial = vi.fn()
const findTvdbSpecialRange = vi.fn()
const parseMetadataFromName = vi.fn()
const isWithinAnyRoot = vi.fn()
const resolveMediaFilePath = vi.fn<(path: string) => Promise<string>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

    getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/media'] })
    parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
    getDetails.mockResolvedValue(null)
    findByExternalID.mockResolvedValue({})
    findByTitle.mockResolvedValue({})
    findLocale.mockResolvedValue(undefined)
    findTvdbSpecial.mockResolvedValue(null)
    findTvdbSpecialRange.mockResolvedValue(null)
    parseMetadataFromName.mockReturnValue({
        title: 'Parsed Title',
        sourceType: 'WEB-DL',
        source: 'Web',
        service: undefined,
        cut: undefined,
        repack: 0,
        proper: 0,
        hybrid: false,
        releaseGroup: undefined,
    })
    isWithinAnyRoot.mockReturnValue(true)
    resolveMediaFilePath.mockImplementation(async (path) => path)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        getQuery,
        createError,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/services/mediainfo', () => ({
        parseMetadataFromMediainfo,
    }))
    vi.doMock('../../../../server/services/media-name-parser', () => ({
        parseMetadataFromName,
    }))
    vi.doMock('../../../../server/utils/file-system', () => ({
        isWithinAnyRoot,
        resolveMediaFilePath,
    }))
    vi.doMock('../../../../server/services/tmdb', () => ({
        ID_TYPES: { IMDB: 'imdb_id', TVDB: 'tvdb_id' },
        getDetails,
        findByExternalID,
        findByTitle,
        findLocale,
    }))
    vi.doMock('../../../../server/services/tvdb', () => ({
        findTvdbSpecial,
        findTvdbSpecialRange,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        createLogger: () => logger,
    }))

    const { default: handler } = await import('../../../../server/api/metadata.get')
    return handler
}

describe('GET /api/metadata route handler', () => {
    it('rejects request when path is missing', async () => {
        getQuery.mockReturnValue({})
        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'invalid_path' })
    })

    it('rejects request when resolved path is outside configured roots', async () => {
        getQuery.mockReturnValue({ path: '/outside/movie.mkv' })
        isWithinAnyRoot.mockReturnValue(false)
        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'invalid_path' })
    })

    it('uses tmdb id when present and reads external ids from details response', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Detail Title',
            original_title: 'Original',
            original_language: 'en',
            year: 2024,
            external_ids: { imdb_id: 'tt123', tvdb_id: 456 },
            logo_url: 'https://image.tmdb.org/t/p/original/logo.png',
        })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            logoUrl: 'https://image.tmdb.org/t/p/original/logo.png',
            metadata: {
                tmdbId: 100,
                title: 'Detail Title',
                originalTitle: 'Original',
                originalLanguage: 'en',
                year: 2024,
                imdbId: 'tt123',
                tvdbId: 456,
            },
        })
        expect(getDetails).toHaveBeenCalledWith('100', 'movie')
    })

    it('sets locale when findLocale returns a country code for tmdb id path', async () => {
        getQuery.mockReturnValue({ path: '/media/show.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Show',
            season: 1,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: {} })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { locale: 'US' } })
        expect(findLocale).toHaveBeenCalledWith('The Office', 100, 'tv')
    })

    it('uses imdb id lookup to resolve tmdb details', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'From IMDb', original_title: 'Orig IMDb', original_language: 'fr', year: 2001, external_ids: { imdb_id: 'tt999' } })
        getDetails.mockResolvedValue({
            title: 'IMDb Detail',
            original_title: 'IMDb Detail Original',
            original_language: 'fr',
            year: 2002,
            origin_country: 'FR',
            external_ids: { imdb_id: 'tt999' },
        })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            metadata: {
                tmdbId: 11,
                title: 'IMDb Detail',
                originalTitle: 'IMDb Detail Original',
                originalLanguage: 'fr',
                year: 2002,
                imdbId: 'tt999',
                originCountry: 'FR',
            },
        })
        expect(getDetails).toHaveBeenCalledWith('11', 'movie')
    })

    it('uses tvdb id lookup to resolve tmdb details', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: 12, title: 'From TVDB', original_title: 'Orig TVDB', original_language: 'es', year: 2010, external_ids: { tvdb_id: 222 } })
        getDetails.mockResolvedValue({
            title: 'TVDB Detail',
            original_title: 'TVDB Detail Original',
            original_language: 'es',
            year: 2011,
            origin_country: 'ES',
            external_ids: { tvdb_id: 222 },
        })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            metadata: { tmdbId: 12, title: 'TVDB Detail', originalTitle: 'TVDB Detail Original', originalLanguage: 'es', year: 2011, tvdbId: 222, originCountry: 'ES' },
        })
        expect(getDetails).toHaveBeenCalledWith('12', 'movie')
    })

    it('sets locale for imdb id path when findLocale detects duplicate', async () => {
        getQuery.mockReturnValue({ path: '/media/show.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Show',
            season: 1,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { imdb_id: 'tt999' } })
        getDetails.mockResolvedValue({ title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { imdb_id: 'tt999' } })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { locale: 'US' } })
        expect(findLocale).toHaveBeenCalledWith('The Office', 11, 'tv')
    })

    it('falls back to title lookup when no ids are present', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Movie.2020.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Movie',
            year: 2020,
            originalTitle: 'Filename Original',
            sourceType: 'WEB-DL',
            source: 'Web',
            repack: 0,
            proper: 0,
            hybrid: false,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 13, title: 'Title Match', original_title: 'Original Match', original_language: 'de', year: 2020 })
        getDetails.mockResolvedValue({ title: 'Detail Match', original_title: 'Detail Original', original_language: 'de', year: 2021, origin_country: 'DE', external_ids: {} })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            metadata: { tmdbId: 13, title: 'Detail Match', originalTitle: 'Detail Original', originalLanguage: 'de', year: 2021, originCountry: 'DE' },
        })
        expect(findByTitle).toHaveBeenCalledWith('The Movie', 'movie', 2020)
        expect(getDetails).toHaveBeenCalledWith('13', 'movie')
    })

    it('uses tv media type when season exists and queries tmdb with tv', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Show.S01E01.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Show',
            season: 1,
            episode: 1,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 20, title: 'Show Title', original_title: 'Show Title', original_language: 'en', year: 2021 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { mediaType: 'tv', tmdbId: 20 } })
        expect(findByTitle).toHaveBeenCalledWith('The Show', 'tv', undefined)
    })

    it('applies external ids from details on title lookup path', async () => {
        getQuery.mockReturnValue({ path: '/media/Unknown.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 42, title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020 })
        getDetails.mockResolvedValue({ title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020, external_ids: { imdb_id: 'tt000', tvdb_id: undefined } })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { imdbId: 'tt000', tvdbId: undefined } })
        expect(getDetails).toHaveBeenCalledWith('42', 'movie')
    })

    it('resolves first file when input path is a directory', async () => {
        getQuery.mockReturnValue({ path: '/media/dir' })
        resolveMediaFilePath.mockResolvedValue('/media/dir/a.mkv')
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 1, title: 'T', original_title: 'OT', original_language: 'en', year: 2024 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { tmdbId: 1 } })
        expect(parseMetadataFromMediainfo).toHaveBeenCalledWith('/media/dir/a.mkv', 'WEB-DL')
    })

    it('rejects directory path when no files are found', async () => {
        getQuery.mockReturnValue({ path: '/media/empty-dir' })
        resolveMediaFilePath.mockRejectedValue({ statusCode: 400, message: 'no_media_file_found' })

        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'no_media_file_found' })
    })

    it('rejects path when stat is neither file nor directory', async () => {
        getQuery.mockReturnValue({ path: '/media/pipe' })
        resolveMediaFilePath.mockRejectedValue({ statusCode: 400, message: 'invalid_path' })

        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'invalid_path' })
    })

    it('skips findLocale when title is missing after getDetails', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: undefined, original_title: 'Original', original_language: 'en', year: 2024, external_ids: {} })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('falls back to existing imdbId when findByExternalID returns no imdb_id', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'From IMDb', original_title: 'Orig', original_language: 'fr', year: 2001, external_ids: {} })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.imdbId).toBe('tt999')
    })

    it('skips enrichment when getDetails returns null', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.title).toBe('Parsed Title')
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('skips enrichment when findByExternalID returns null on imdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.title).toBe('Parsed Title')
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('skips findLocale when findByExternalID returns no tmdbId on imdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: undefined, title: 'Some Title', external_ids: {} })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('sets locale for tvdb id path when findLocale detects duplicate', async () => {
        getQuery.mockReturnValue({ path: '/media/show.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Show',
            season: 1,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: 12, title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { tvdb_id: 222 } })
        getDetails.mockResolvedValue({ title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { tvdb_id: 222 } })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ metadata: { locale: 'US' } })
        expect(findLocale).toHaveBeenCalledWith('The Office', 12, 'tv')
    })

    it('skips enrichment when findByExternalID returns null on tvdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.title).toBe('Parsed Title')
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('skips findLocale when findByExternalID returns no tmdbId on tvdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: undefined, title: 'Some Title', external_ids: {} })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('leaves external ids empty when details omit them on title lookup path', async () => {
        getQuery.mockReturnValue({ path: '/media/Unknown.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 42, title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020 })
        getDetails.mockResolvedValue({ title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020 })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.imdbId).toBeUndefined()
        expect(result.metadata.tvdbId).toBeUndefined()
    })

    it('enriches special when season=0 and tvdbId and specialName are present', async () => {
        getQuery.mockReturnValue({ path: '/media/Top.Gear.S00E12.Polar.Challenge.1080i.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Top Gear',
            season: 0,
            episode: 12,
            specialName: 'Polar Challenge',
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'FraMeSToR',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 74608 })
        findByExternalID.mockResolvedValue({ id: 9, title: 'Top Gear', original_title: 'Top Gear', original_language: 'en', year: 2002, external_ids: { tvdb_id: 74608 } })
        findTvdbSpecial.mockResolvedValue({ episodeNumber: 2, title: 'Polar Challenge' })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.season).toBe(0)
        expect(result.metadata.episode).toBe(2)
        expect(result.metadata.specialName).toBe('Polar Challenge')
        expect(findTvdbSpecial).toHaveBeenCalledWith(74608, 12, 'Polar Challenge')
    })

    it('keeps filename values when TVDb special lookup returns no match', async () => {
        getQuery.mockReturnValue({ path: '/media/Top.Gear.S27E00.Nepal.Special.1080p.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Top Gear',
            season: 27,
            episode: 0,
            specialName: 'Nepal Special',
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'TBN',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 74608 })
        findByExternalID.mockResolvedValue({ id: 9, title: 'Top Gear', original_title: 'Top Gear', original_language: 'en', year: 2002, external_ids: { tvdb_id: 74608 } })
        findTvdbSpecial.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.season).toBe(27)
        expect(result.metadata.episode).toBe(0)
        expect(result.metadata.specialName).toBe('Nepal Special')
    })

    it('calls findTvdbSpecialRange when episodeEnd is set and updates season, episode range and specialName', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Good.Place.S00E03-E08.The.Selection.1080p.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'The Good Place',
            season: 0,
            episode: 3,
            episodeEnd: 8,
            specialName: 'The Selection',
            sourceType: 'WEB-DL',
            source: 'Web',
            service: 'AMZN',
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'MRKT',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 311711 })
        findByExternalID.mockResolvedValue({
            id: 42,
            title: 'The Good Place',
            original_title: 'The Good Place',
            original_language: 'en',
            year: 2016,
            external_ids: { tvdb_id: 311711 },
        })
        findTvdbSpecialRange.mockResolvedValue({ episodeStart: 3, episodeEnd: 8, title: 'The Selection' })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.season).toBe(0)
        expect(result.metadata.episode).toBe(3)
        expect(result.metadata.episodeEnd).toBe(8)
        expect(result.metadata.specialName).toBe('The Selection')
        expect(findTvdbSpecialRange).toHaveBeenCalledWith(311711, 3, 8)
        expect(findTvdbSpecial).not.toHaveBeenCalled()
    })

    it('keeps filename values when findTvdbSpecialRange returns no match', async () => {
        getQuery.mockReturnValue({ path: '/media/Show.S00E03-E08.Some.Title.1080p.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Show',
            season: 0,
            episode: 3,
            episodeEnd: 8,
            specialName: 'Some Title',
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'GRP',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 99999 })
        findByExternalID.mockResolvedValue({ id: 5, title: 'Show', original_title: 'Show', original_language: 'en', year: 2020, external_ids: { tvdb_id: 99999 } })
        findTvdbSpecialRange.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.season).toBe(0)
        expect(result.metadata.episode).toBe(3)
        expect(result.metadata.episodeEnd).toBe(8)
        expect(result.metadata.specialName).toBe('Some Title')
    })

    it('skips range lookup and falls back to findTvdbSpecial when episodeEnd is absent', async () => {
        getQuery.mockReturnValue({ path: '/media/Top.Gear.S00E12.Polar.Challenge.1080i.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Top Gear',
            season: 0,
            episode: 12,
            specialName: 'Polar Challenge',
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'FraMeSToR',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 74608 })
        findByExternalID.mockResolvedValue({ id: 9, title: 'Top Gear', original_title: 'Top Gear', original_language: 'en', year: 2002, external_ids: { tvdb_id: 74608 } })
        findTvdbSpecial.mockResolvedValue({ episodeNumber: 2, title: 'Polar Challenge' })

        const handler = await loadHandler()
        await handler({} as never)
        expect(findTvdbSpecialRange).not.toHaveBeenCalled()
        expect(findTvdbSpecial).toHaveBeenCalledWith(74608, 12, 'Polar Challenge')
    })

    it('calls findTvdbSpecial with episode number even when specialName is absent', async () => {
        getQuery.mockReturnValue({ path: '/media/Show.S00E05.1080p.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Show',
            season: 0,
            episode: 5,
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'GRP',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 74608 })
        findByExternalID.mockResolvedValue({ id: 9, title: 'Show', original_title: 'Show', original_language: 'en', year: 2010, external_ids: { tvdb_id: 74608 } })

        const handler = await loadHandler()
        await handler({} as never)
        expect(findTvdbSpecial).toHaveBeenCalledWith(74608, 5, undefined)
        expect(findTvdbSpecialRange).not.toHaveBeenCalled()
    })

    it('skips TVDb special lookup when season is 0 but episode number is absent', async () => {
        getQuery.mockReturnValue({ path: '/media/Show.S00.1080p.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Show',
            season: 0,
            episode: undefined,
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: 'GRP',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 74608 })
        findByExternalID.mockResolvedValue({ id: 9, title: 'Show', original_title: 'Show', original_language: 'en', year: 2010, external_ids: { tvdb_id: 74608 } })

        const handler = await loadHandler()
        await handler({} as never)
        expect(findTvdbSpecial).not.toHaveBeenCalled()
        expect(findTvdbSpecialRange).not.toHaveBeenCalled()
    })

    it('selects a transliteration included in TMDB details', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Фильм',
            original_title: undefined,
            original_language: 'ru',
            year: 2020,
            external_ids: {},
            alternative_titles: [{ iso_3166_1: 'US', title: 'Film', type: 'transliteration' }],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Film')
    })

    it('selects a transliteration for English-language media too', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Movie',
            original_title: 'Original Movie',
            original_language: 'en',
            year: 2020,
            external_ids: {},
            alternative_titles: [{ iso_3166_1: 'US', title: 'Romanized Movie', type: 'romanized' }],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Romanized Movie')
    })

    it('preserves the details original title when no transliteration matches', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: 'Movie', original_title: 'Фильм', original_language: 'ru', year: 2020, external_ids: {} })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Фильм')
    })

    it('skips details enrichment when tmdbId is absent', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue(null)

        const handler = await loadHandler()
        await handler({} as never)
        expect(getDetails).not.toHaveBeenCalled()
    })

    it('falls back to locale entry when no transliteration entry exists and locale is already set', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 100, title: 'Фильм', original_title: undefined, original_language: 'ru', year: 2020, origin_country: 'RU' })
        getDetails.mockResolvedValue({
            title: 'Фильм',
            original_title: undefined,
            original_language: 'ru',
            year: 2020,
            origin_country: 'RU',
            external_ids: {},
            alternative_titles: [
                { iso_3166_1: 'RU', title: 'Film RU', type: 'imdb title' },
                { iso_3166_1: 'US', title: 'Film US', type: 'imdb title' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Film RU')
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('selects an origin-country romanization instead of the first native-script title', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 33346 })
        getDetails.mockResolvedValue({
            title: 'Between Calmness and Passion',
            original_title: undefined,
            original_language: 'ja',
            year: 2001,
            external_ids: {},
            origin_country: 'JP',
            alternative_titles: [
                { iso_3166_1: 'JP', title: '冷静と情熱のあいだ', type: '' },
                { iso_3166_1: 'JP', title: 'Reisei to jounetsu no aida', type: '' },
                { iso_3166_1: 'JP', title: 'Reisei to jônetsu no aida', type: '' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Reisei to jônetsu no aida')
    })

    it('selects a TMDB romanized title', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 1609125 })
        getDetails.mockResolvedValue({
            title: "The Butcher's Blade",
            original_title: undefined,
            original_language: 'zh',
            year: 2026,
            origin_country: 'CN',
            external_ids: {},
            alternative_titles: [
                { iso_3166_1: 'CN', title: '鹰犬', type: '' },
                { iso_3166_1: 'US', title: 'Broken Elite Agent', type: '' },
                { iso_3166_1: 'CN', title: 'Shou zhe tian', type: 'romanized' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Shou zhe tian')
    })

    it('falls back to a US alternative title when no origin-country title exists', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 659924 })
        getDetails.mockResolvedValue({
            title: 'Loveland',
            original_title: 'Loveland',
            original_language: 'en',
            year: 2022,
            origin_country: 'AU',
            external_ids: { imdb_id: 'tt10295314' },
            alternative_titles: [
                { iso_3166_1: 'US', title: 'Expired', type: '' },
                { iso_3166_1: 'IT', title: 'Terra amata', type: '' },
                { iso_3166_1: 'KR', title: '러브랜드', type: '' },
                { iso_3166_1: 'RU', title: 'Лавленд', type: '' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Expired')
    })

    it('prefers the US alternative matching the TMDB title', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 1128650 })
        getDetails.mockResolvedValue({
            title: 'The Prosecutor',
            original_title: undefined,
            original_language: 'cn',
            year: 2024,
            origin_country: 'HK',
            external_ids: { imdb_id: 'tt30024043' },
            alternative_titles: [
                { iso_3166_1: 'US', title: 'Misjudgement', type: '' },
                { iso_3166_1: 'TW', title: '誤判', type: '' },
                { iso_3166_1: 'US', title: 'The Prosecutor', type: '' },
                { iso_3166_1: 'CN', title: '误判', type: '' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('The Prosecutor')
    })

    it('selects equivalent alternative titles independently of TMDB response order', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Movie',
            original_title: undefined,
            original_language: 'ja',
            year: 2020,
            origin_country: 'JP',
            external_ids: {},
            alternative_titles: [
                { iso_3166_1: 'JP', title: 'Zeta', type: '' },
                { iso_3166_1: 'JP', title: 'Alpha', type: '' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Alpha')
    })

    it('prefers an explicit transliteration over an origin-country title', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Movie',
            original_title: undefined,
            original_language: 'ja',
            year: 2020,
            origin_country: 'JP',
            external_ids: {},
            alternative_titles: [
                { iso_3166_1: 'JP', title: 'Origin Title', type: '' },
                { iso_3166_1: 'US', title: 'Typed Title', type: 'transliteration' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Typed Title')
    })

    it('ignores explicit transliterations that are not Latin script', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Movie',
            original_title: undefined,
            original_language: 'ja',
            year: 2020,
            origin_country: 'JP',
            external_ids: {},
            alternative_titles: [{ iso_3166_1: 'JP', title: '冷静と情熱のあいだ', type: 'transliteration' }],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBeUndefined()
    })

    it('calls getDetails to resolve originCountry when originCountry is absent and no transliteration entry exists', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({
            title: 'Фильм',
            original_title: undefined,
            original_language: 'ru',
            year: 2020,
            external_ids: {},
            origin_country: 'RU',
            alternative_titles: [
                { iso_3166_1: 'RU', title: 'Film RU', type: 'imdb title' },
                { iso_3166_1: 'US', title: 'Film US', type: 'imdb title' },
            ],
        })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBe('Film RU')
        expect(findLocale).not.toHaveBeenCalled()
        expect(getDetails).toHaveBeenCalledWith('100', 'movie')
    })

    it('leaves originalTitle empty when alternative titles returns empty array', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: 'Фильм', original_title: undefined, original_language: 'ru', year: 2020, external_ids: {} })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.originalTitle).toBeUndefined()
    })

    it('upgrades BluRay source to UHD BluRay when resolution is 2160p', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({ title: 'Movie', sourceType: 'ENCODE', source: 'BluRay', repack: 0, proper: 0, hybrid: false, releaseGroup: undefined })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], resolution: '2160p' })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.source).toBe('UHD BluRay')
    })

    it('does not upgrade BluRay source when resolution is not 2160p', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({ title: 'Movie', sourceType: 'ENCODE', source: 'BluRay', repack: 0, proper: 0, hybrid: false, releaseGroup: undefined })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], resolution: '1080p' })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.source).toBe('BluRay')
    })

    it('calls findByTitle with undefined when parsed title is undefined', async () => {
        getQuery.mockReturnValue({ path: '/media/UnknownTitle.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: undefined,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue(null)

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findByTitle).toHaveBeenCalledWith(undefined, 'movie', undefined)
    })

    it.each([
        { mediainfo: { videoStandard: 'PAL' }, expected: 'PAL DVD' },
        { mediainfo: { frameRate: 25 }, expected: 'PAL DVD' },
        { mediainfo: { frameRate: 50 }, expected: 'PAL DVD' },
        { mediainfo: { videoStandard: 'NTSC' }, expected: 'NTSC DVD' },
        { mediainfo: { frameRate: 29.97 }, expected: 'NTSC DVD' },
    ])('upgrades DVD source to $expected for $mediainfo', async ({ mediainfo, expected }) => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({ title: 'Movie', sourceType: 'ENCODE', source: 'DVD', repack: 0, proper: 0, hybrid: false, releaseGroup: undefined })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], ...mediainfo })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.source).toBe(expected)
    })

    it('does not upgrade source when source is not DVD', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({ title: 'Movie', sourceType: 'ENCODE', source: 'BluRay', repack: 0, proper: 0, hybrid: false, releaseGroup: undefined })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], videoStandard: 'PAL', frameRate: 25 })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.source).toBe('BluRay')
    })

    it('leaves DVD source unchanged when no videoStandard or frameRate is available', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({ title: 'Movie', sourceType: 'ENCODE', source: 'DVD', repack: 0, proper: 0, hybrid: false, releaseGroup: undefined })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.source).toBe('DVD')
    })

    it('uses name-parsed resolution when mediainfo cannot determine resolution', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Movie',
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
            resolution: '2160p',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], resolution: undefined })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.resolution).toBe('2160p')
    })

    it('mediainfo resolution takes precedence over name-parsed resolution', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromName.mockReturnValue({
            title: 'Movie',
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: 0,
            proper: 0,
            hybrid: false,
            releaseGroup: undefined,
            resolution: '2160p',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], resolution: '1080p' })

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.metadata.resolution).toBe('1080p')
    })
})
