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
const getExternalIDs = vi.fn()
const parseMetadataFromName = vi.fn()
const isWithinAnyRoot = vi.fn()
const resolveMediaFilePath = vi.fn<(path: string) => Promise<string>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

    getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/media'] })
    parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
    getDetails.mockResolvedValue({})
    findByExternalID.mockResolvedValue({})
    findByTitle.mockResolvedValue({})
    findLocale.mockResolvedValue(undefined)
    getExternalIDs.mockResolvedValue({})
    parseMetadataFromName.mockReturnValue({
        title: 'Parsed Title',
        sourceType: 'WEB-DL',
        source: 'Web',
        service: undefined,
        cut: undefined,
        repack: 0,
        proper: 0,
        hybrid: false,
        releaseGroup: '',
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
        getExternalIDs,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
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
        getDetails.mockResolvedValue({ title: 'Detail Title', original_title: 'Original', original_language: 'en', year: 2024, external_ids: { imdb_id: 'tt123', tvdb_id: 456 } })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            tmdbId: 100,
            title: 'Detail Title',
            originalTitle: 'Original',
            originalLanguage: 'en',
            year: 2024,
            imdbId: 'tt123',
            tvdbId: 456,
        })
        expect(getExternalIDs).not.toHaveBeenCalled()
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
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: {} })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ locale: 'US' })
        expect(findLocale).toHaveBeenCalledWith('The Office', 100, 'tv')
    })

    it('uses imdb id lookup when tmdb id is missing and reads external ids from find response', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'From IMDb', original_title: 'Orig IMDb', original_language: 'fr', year: 2001, external_ids: { imdb_id: 'tt999' } })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({
            tmdbId: 11,
            title: 'From IMDb',
            originalTitle: 'Orig IMDb',
            originalLanguage: 'fr',
            year: 2001,
            imdbId: 'tt999',
        })
        expect(getExternalIDs).not.toHaveBeenCalled()
    })

    it('uses tvdb id lookup when tmdb and imdb ids are missing and reads external ids from find response', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: 12, title: 'From TVDB', original_title: 'Orig TVDB', original_language: 'es', year: 2010, external_ids: { tvdb_id: 222 } })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 12, title: 'From TVDB', originalTitle: 'Orig TVDB', originalLanguage: 'es', year: 2010, tvdbId: 222 })
        expect(getExternalIDs).not.toHaveBeenCalled()
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
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { imdb_id: 'tt999' } })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ locale: 'US' })
        expect(findLocale).toHaveBeenCalledWith('The Office', 11, 'tv')
    })

    it('falls back to title lookup when no ids are present', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Movie.2020.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 13, title: 'Title Match', original_title: 'Original Match', original_language: 'de', year: 2020 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 13, title: 'Title Match', originalTitle: 'Original Match', originalLanguage: 'de', year: 2020 })
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
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 20, title: 'Show Title', original_title: 'Show Title', original_language: 'en', year: 2021 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ mediaType: 'tv', tmdbId: 20 })
        expect(findByTitle).toHaveBeenCalledWith('The Show', 'tv')
    })

    it('calls getExternalIDs on title lookup path and applies result', async () => {
        getQuery.mockReturnValue({ path: '/media/Unknown.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 42, title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020 })
        getExternalIDs.mockResolvedValue({ imdb_id: 'tt000', tvdb_id: undefined })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ imdbId: 'tt000', tvdbId: undefined })
        expect(getExternalIDs).toHaveBeenCalledWith('42', 'movie')
    })

    it('resolves first file when input path is a directory', async () => {
        getQuery.mockReturnValue({ path: '/media/dir' })
        resolveMediaFilePath.mockResolvedValue('/media/dir/a.mkv')
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 1, title: 'T', original_title: 'OT', original_language: 'en', year: 2024 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 1 })
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
        expect(result.imdbId).toBe('tt999')
    })

    it('skips enrichment when getDetails returns null', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.title).toBe('Parsed Title')
        expect(findLocale).not.toHaveBeenCalled()
    })

    it('skips enrichment when findByExternalID returns null on imdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.title).toBe('Parsed Title')
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
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: 12, title: 'The Office', original_title: 'The Office', original_language: 'en', year: 2005, external_ids: { tvdb_id: 222 } })
        findLocale.mockResolvedValue('US')

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ locale: 'US' })
        expect(findLocale).toHaveBeenCalledWith('The Office', 12, 'tv')
    })

    it('skips enrichment when findByExternalID returns null on tvdb path', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.title).toBe('Parsed Title')
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

    it('skips external id assignment when getExternalIDs returns null on title lookup path', async () => {
        getQuery.mockReturnValue({ path: '/media/Unknown.mkv' })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 42, title: 'Found', original_title: 'Found Orig', original_language: 'en', year: 2020 })
        getExternalIDs.mockResolvedValue(null)

        const handler = await loadHandler()
        const result = await handler({} as never)
        expect(result.imdbId).toBeUndefined()
        expect(result.tvdbId).toBeUndefined()
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
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue(null)

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findByTitle).toHaveBeenCalledWith(undefined, 'movie')
    })
})
