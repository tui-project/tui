import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}
const getQuery = vi.fn<() => { path?: string }>()
const createError = vi.fn((payload: unknown) => payload)
const getSettings = vi.fn<() => Promise<{ id: string; mediaPaths: string[] }>>()
const parseMetadataFromMediainfo = vi.fn<() => Promise<unknown>>()
const realpath = vi.fn<(path: string) => Promise<string>>()
const stat = vi.fn<(path: string) => Promise<{ isFile: () => boolean; isDirectory: () => boolean }>>()
const readdir = vi.fn<(path: string) => Promise<string[]>>()
const getDetails = vi.fn()
const findByExternalID = vi.fn()
const findByTitle = vi.fn()
const getExternalIDs = vi.fn()
const parseMetadataFromName = vi.fn()
const isWithinAnyRoot = vi.fn()
const resolveUniqueRealPaths = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

    getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/media'] })
    parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
    getDetails.mockResolvedValue({})
    findByExternalID.mockResolvedValue({})
    findByTitle.mockResolvedValue({})
    getExternalIDs.mockResolvedValue({})
    parseMetadataFromName.mockReturnValue({
        title: 'Parsed Title',
        sourceType: 'WEB-DL',
        source: 'Web',
        service: undefined,
        cut: undefined,
        repack: false,
        proper: false,
        hybrid: false,
        releaseGroup: '',
    })
    isWithinAnyRoot.mockReturnValue(true)
    resolveUniqueRealPaths.mockResolvedValue(['/media'])
    realpath.mockImplementation(async (path) => path)
    readdir.mockResolvedValue([])
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        getQuery,
        createError,
    }))
    vi.doMock('node:fs/promises', () => ({
        realpath,
        stat,
        readdir,
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
    vi.doMock('../../../../server/services/tmdb', () => ({
        ID_TYPES: { IMDB: 'imdb_id', TVDB: 'tvdb_id' },
        getDetails,
        findByExternalID,
        findByTitle,
        getExternalIDs,
    }))
    vi.doMock('../../../../server/utils/file-system', () => ({
        isWithinAnyRoot,
        resolveUniqueRealPaths,
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

    it('uses tmdb id when present and backfills external ids', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tmdbId: 100 })
        getDetails.mockResolvedValue({ title: 'Detail Title', original_title: 'Original', original_language: 'en', year: 2024 })
        getExternalIDs.mockResolvedValue({ imdb_id: 'tt123', tvdb_id: 456 })

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
    })

    it('uses imdb id lookup when tmdb id is missing', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], imdbId: 'tt999' })
        findByExternalID.mockResolvedValue({ id: 11, title: 'From IMDb', original_title: 'Orig IMDb', original_language: 'fr', year: 2001 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 11, title: 'From IMDb', originalTitle: 'Orig IMDb', originalLanguage: 'fr', year: 2001 })
    })

    it('uses tvdb id lookup when tmdb and imdb ids are missing', async () => {
        getQuery.mockReturnValue({ path: '/media/movie.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [], tvdbId: 222 })
        findByExternalID.mockResolvedValue({ id: 12, title: 'From TVDB', original_title: 'Orig TVDB', original_language: 'es', year: 2010 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 12, title: 'From TVDB', originalTitle: 'Orig TVDB', originalLanguage: 'es', year: 2010 })
    })

    it('falls back to title lookup when no ids are present', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Movie.2020.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 13, title: 'Title Match', original_title: 'Original Match', original_language: 'de', year: 2020 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 13, title: 'Title Match', originalTitle: 'Original Match', originalLanguage: 'de', year: 2020 })
    })

    it('uses tv media type when season exists and queries tmdb with tv', async () => {
        getQuery.mockReturnValue({ path: '/media/The.Show.S01E01.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromName.mockReturnValue({
            title: 'The Show',
            season: 1,
            episode: 1,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: false,
            proper: false,
            hybrid: false,
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 20, title: 'Show Title', original_title: 'Show Title', original_language: 'en', year: 2021 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ mediaType: 'tv', tmdbId: 20 })
        expect(findByTitle).toHaveBeenCalledWith('The Show', 'tv')
    })

    it('keeps external id fallback when title lookup returns no tmdb id', async () => {
        getQuery.mockReturnValue({ path: '/media/Unknown.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({})
        getExternalIDs.mockResolvedValue({ imdb_id: '', tvdb_id: null })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ imdbId: '', tvdbId: undefined })
        expect(getExternalIDs).toHaveBeenCalledWith('', 'movie')
    })

    it('resolves first file when input path is a directory', async () => {
        getQuery.mockReturnValue({ path: '/media/dir' })
        stat.mockImplementation(async (path: string) => {
            if (path === '/media/dir') return { isFile: () => false, isDirectory: () => true }
            return { isFile: () => path.endsWith('.mkv'), isDirectory: () => false }
        })
        readdir.mockResolvedValue(['b.txt', 'a.mkv'])
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({ id: 1, title: 'T', original_title: 'OT', original_language: 'en', year: 2024 })

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toMatchObject({ tmdbId: 1 })
        expect(parseMetadataFromMediainfo).toHaveBeenCalledWith('/media/dir/a.mkv', 'WEB-DL')
    })

    it('rejects directory path when no files are found', async () => {
        getQuery.mockReturnValue({ path: '/media/empty-dir' })
        stat.mockResolvedValue({ isFile: () => false, isDirectory: () => true })
        readdir.mockResolvedValue(['a-folder', 'b-folder'])
        stat.mockImplementation(async (path: string) => ({
            isFile: () => false,
            isDirectory: () => path === '/media/empty-dir',
        }))

        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'no_media_file_found' })
    })

    it('rejects path when stat is neither file nor directory', async () => {
        getQuery.mockReturnValue({ path: '/media/pipe' })
        stat.mockResolvedValue({ isFile: () => false, isDirectory: () => false })

        const handler = await loadHandler()
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'invalid_path' })
    })

    it('uses empty title when parsed title is undefined', async () => {
        getQuery.mockReturnValue({ path: '/media/UnknownTitle.mkv' })
        stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        parseMetadataFromName.mockReturnValue({
            title: undefined,
            sourceType: 'WEB-DL',
            source: 'Web',
            service: undefined,
            cut: undefined,
            repack: false,
            proper: false,
            hybrid: false,
            releaseGroup: '',
        })
        parseMetadataFromMediainfo.mockResolvedValue({ hdr: [], language: [] })
        findByTitle.mockResolvedValue({})

        const handler = await loadHandler()
        await expect(handler({} as never)).resolves.toBeTruthy()
        expect(findByTitle).toHaveBeenCalledWith('', 'movie')
    })
})
