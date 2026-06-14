import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultFindDuplicates, getTorrents, upload } from '../../../../../server/services/tracker/unit3d-tracker'
import { MEDIA_TYPES, SOURCE_TYPES, SOURCES, RESOLUTIONS } from '../../../../../server/model/metadata'
import { TrackerError, type TrackerUploadMetadata, type TrackerUploadOptions } from '../../../../../server/services/tracker/tracker'
import { parseMetadataFromName } from '../../../../../server/services/media-name-parser'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../../../../../server/services/media-name-parser', () => ({
    parseMetadataFromName: vi.fn(() => ({ season: undefined, episode: undefined, repack: 0, proper: 0, rerip: 0, hdr: [], videoCodec: undefined })),
}))

const readFileMock = vi.mocked(readFile)

const baseMetadata: TrackerUploadMetadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: MEDIA_TYPES.MOVIE,
    year: 2024,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: SOURCE_TYPES.ENCODE,
    source: SOURCES.BLURAY,
    repack: 0,
    proper: 0,
    rerip: 0,
    threeD: false,
    hybrid: false,
    resolution: RESOLUTIONS['1080p'],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

const baseOptions: TrackerUploadOptions = { anonymous: false, modQueueOptIn: false }

const URL = 'https://tracker.example.com'
const API_KEY = 'apikey'
const MOCK_DOWNLOAD_URL = 'https://tracker.example.com/torrent/download/123'

beforeEach(() => {
    readFileMock.mockResolvedValue(Buffer.from('torrent-data') as never)
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: MOCK_DOWNLOAD_URL }))
})

describe('upload', () => {
    it('reads the torrent file and returns the download URL', async () => {
        await expect(upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'description', 'mediainfo text', 'Movie Title', baseOptions)).resolves.toBe(MOCK_DOWNLOAD_URL)
        expect(readFileMock).toHaveBeenCalledWith('/path/to/movie.torrent')
    })

    it('includes optional tvdbId, season, and episode in form data when present', async () => {
        await expect(
            upload(URL, API_KEY, '/path/to/movie.torrent', { ...baseMetadata, tvdbId: 99, season: 2, episode: 5 }, 'desc', 'mi', 'Movie Title', { ...baseOptions, anonymous: true })
        ).resolves.toBe(MOCK_DOWNLOAD_URL)
    })

    it('sends episode_number=0 for season packs (season set, episode undefined)', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(
            URL,
            API_KEY,
            '/path/to/movie.torrent',
            { ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: undefined },
            'desc',
            'mi',
            'Movie Title',
            baseOptions
        )
        expect(appendSpy).toHaveBeenCalledWith('season_number', '1')
        expect(appendSpy).toHaveBeenCalledWith('episode_number', '0')
    })

    it('does not send episode_number when season is absent (movie)', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', baseOptions)
        expect(appendSpy).not.toHaveBeenCalledWith('episode_number', expect.anything())
    })

    it('strips tt prefix from imdbId', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', { ...baseMetadata, imdbId: 'tt9876543' }, 'desc', 'mi', 'Movie Title', baseOptions)
        expect(appendSpy).toHaveBeenCalledWith('imdb', '9876543')
    })

    it('passes imdbId unchanged when tt prefix is absent', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', { ...baseMetadata, imdbId: '1234567' }, 'desc', 'mi', 'Movie Title', baseOptions)
        expect(appendSpy).toHaveBeenCalledWith('imdb', '1234567')
    })

    it('appends anonymous as "1" when anonymous is true', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', { ...baseOptions, anonymous: true })
        expect(appendSpy).toHaveBeenCalledWith('anonymous', '1')
    })

    it('appends mod_queue_opt_in as "1" when modQueueOptIn is true', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', { ...baseOptions, modQueueOptIn: true })
        expect(appendSpy).toHaveBeenCalledWith('mod_queue_opt_in', '1')
    })

    it('appends mod_queue_opt_in as "0" when modQueueOptIn is false', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', baseOptions)
        expect(appendSpy).toHaveBeenCalledWith('mod_queue_opt_in', '0')
    })

    it('appends correct category_id, type_id, and resolution_id for movie encode 1080p', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(
            URL,
            API_KEY,
            '/path/to/movie.torrent',
            { ...baseMetadata, mediaType: MEDIA_TYPES.MOVIE, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['1080p'] },
            'desc',
            'mi',
            'Movie Title',
            baseOptions
        )
        expect(appendSpy).toHaveBeenCalledWith('category_id', '1')
        expect(appendSpy).toHaveBeenCalledWith('type_id', '3')
        expect(appendSpy).toHaveBeenCalledWith('resolution_id', '3')
    })

    it('appends correct category_id for TV and type_id for REMUX', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(
            URL,
            API_KEY,
            '/path/to/movie.torrent',
            { ...baseMetadata, mediaType: MEDIA_TYPES.TV, sourceType: SOURCE_TYPES.REMUX, resolution: RESOLUTIONS['2160p'] },
            'desc',
            'mi',
            'Movie Title',
            baseOptions
        )
        expect(appendSpy).toHaveBeenCalledWith('category_id', '2')
        expect(appendSpy).toHaveBeenCalledWith('type_id', '2')
        expect(appendSpy).toHaveBeenCalledWith('resolution_id', '2')
    })

    it('appends tmdb id as string', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', { ...baseMetadata, tmdbId: 42 }, 'desc', 'mi', 'Movie Title', baseOptions)
        expect(appendSpy).toHaveBeenCalledWith('tmdb', '42')
    })

    it('appends extraFields to form data when provided', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', baseOptions, { dv: '1', hdr: '0' })
        expect(appendSpy).toHaveBeenCalledWith('dv', '1')
        expect(appendSpy).toHaveBeenCalledWith('hdr', '0')
    })

    async function catchUploadError(data: unknown, statusCode: number): Promise<TrackerError> {
        const fetchError = Object.assign(new Error(), { statusCode, data })
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError))
        return upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', baseOptions).then(
            () => {
                throw new Error('expected upload to fail')
            },
            (e) => e as TrackerError
        )
    }

    it('extracts field messages from errors shape (e.g. duplicate name)', async () => {
        const data = { message: 'The name has already been taken.', errors: { name: ['The name has already been taken.'] } }
        const error = await catchUploadError(data, 422)
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.reason).toBe('The name has already been taken.')
        expect(error.statusCode).toBe(422)
        expect(error.responseData).toEqual(data)
        expect(error.message).toBe('Tracker upload failed')
    })

    it('extracts field messages from data shape (e.g. invalid category)', async () => {
        const data = { success: false, message: 'Validation Error.', data: { category_id: ['The selected category id is invalid.'] } }
        const error = await catchUploadError(data, 422)
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.reason).toBe('The selected category id is invalid.')
    })

    it('joins multiple field validation messages', async () => {
        const data = { message: 'Validation Error.', errors: { name: ['The name has already been taken.'], info_hash: ['The info hash has already been taken.'] } }
        const error = await catchUploadError(data, 422)
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.reason).toBe('The name has already been taken. The info hash has already been taken.')
    })

    it('falls back to top-level message when no field errors are present', async () => {
        const error = await catchUploadError({ message: 'Unprocessable Entity' }, 422)
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.reason).toBe('Unprocessable Entity')
    })

    it('falls back to raw JSON when data has no recognisable shape', async () => {
        const error = await catchUploadError({ unexpected: true }, 500)
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.reason).toBe('{"unexpected":true}')
    })

    it('throws with unknown status when $fetch rejects with a non-Error value', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue('Internal Server Error'))
        const error = await upload(URL, API_KEY, '/path/to/movie.torrent', baseMetadata, 'desc', 'mi', 'Movie Title', baseOptions).then(
            () => {
                throw new Error('expected upload to fail')
            },
            (e) => e as TrackerError
        )
        expect(error).toBeInstanceOf(TrackerError)
        expect(error.statusCode).toBeUndefined()
        expect(error.responseData).toBeUndefined()
    })
})

function makeTorrentEntry(
    overrides: Partial<{ name: string; details_link: string; resolution_id: number; type_id: number; hdr: string | null; season_number: number; episode_number: number }> = {}
) {
    return {
        attributes: {
            name: 'Movie.2024.1080p.BluRay.ENCODE.x264-GROUP',
            details_link: 'https://tracker.example.com/torrents/1',
            resolution_id: 3,
            type_id: 3,
            hdr: null,
            ...overrides,
        },
    }
}

function makeTorrentResult(
    overrides: Partial<import('../../../../../server/services/tracker/unit3d-tracker').TorrentResult> = {}
): import('../../../../../server/services/tracker/unit3d-tracker').TorrentResult {
    return {
        name: 'Movie.2024.1080p.BluRay.ENCODE.x264-GROUP',
        url: 'https://tracker.example.com/torrents/1',
        hdr: [],
        repack: 0,
        proper: 0,
        rerip: 0,
        hasOriginalAudio: true,
        ...overrides,
    }
}

describe('getTorrents', () => {
    it('returns raw torrent data from the API', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [makeTorrentEntry()] }))
        const result = await getTorrents(URL, API_KEY, { tmdbId: 1 })
        expect(result).toHaveLength(1)
    })

    it('queries with correct params', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ data: [] })
        vi.stubGlobal('$fetch', fetchMock)
        await getTorrents(URL, API_KEY, { tmdbId: 99, mediaType: MEDIA_TYPES.TV, resolutions: [RESOLUTIONS['2160p']], sourceTypes: [SOURCE_TYPES.REMUX] })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('tmdbId=99')
        expect(url).toContain('categories[]=2') // TV = 2
        expect(url).toContain('resolutions[]=2') // 2160p = 2
        expect(url).toContain('types[]=2') // REMUX = 2
        expect(fetchMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }) }))
    })

    it('passes seasonNumber and episodeNumber when provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ data: [] })
        vi.stubGlobal('$fetch', fetchMock)
        await getTorrents(URL, API_KEY, { tmdbId: 1, seasonNumber: 2, episodeNumber: 5 })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('seasonNumber=2')
        expect(url).toContain('episodeNumber=5')
    })

    it('omits params that are undefined', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ data: [] })
        vi.stubGlobal('$fetch', fetchMock)
        await getTorrents(URL, API_KEY, { tmdbId: 1 })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).not.toContain('categories[]=')
        expect(url).not.toContain('resolutions')
        expect(url).not.toContain('types')
        expect(url).not.toContain('seasonNumber')
        expect(url).not.toContain('episodeNumber')
    })

    it('omits tmdbId when not provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ data: [] })
        vi.stubGlobal('$fetch', fetchMock)
        await getTorrents(URL, API_KEY, {})
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).not.toContain('tmdbId')
    })

    it('returns empty array and logs warning when $fetch throws', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Network error')))
        const result = await getTorrents(URL, API_KEY, { tmdbId: 1 })
        expect(result).toEqual([])
    })

    it.each([
        ['Movie 2024 1080p BluRay x264-GROUP', true],
        ['Movie 2024 1080p BluRay Dual-Audio DD+ 5.1 x264-GROUP', true],
        ['Movie 2024 FRENCH 1080p BluRay DD+ 5.1 x264-GROUP', true],
        ['Movie 2024 1080p BluRay Dubbed DD+ 5.1 x264-GROUP', false],
    ])('sets hasOriginalAudio correctly for "%s"', async (name, expected) => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [makeTorrentEntry({ name })] }))
        const [result] = await getTorrents(URL, API_KEY, { tmdbId: 1 })
        expect(result!.hasOriginalAudio).toBe(expected)
    })

    it('maps hdr, videoCodec, repack, proper, rerip, season, episode from parseMetadataFromName', async () => {
        vi.mocked(parseMetadataFromName).mockReturnValueOnce({ season: 2, episode: 5, repack: 1, proper: 0, rerip: 1, hdr: ['DV', 'HDR'], videoCodec: 'x265' } as never)
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [makeTorrentEntry()] }))
        const [result] = await getTorrents(URL, API_KEY, { tmdbId: 1 })
        expect(result!.hdr).toEqual(['DV', 'HDR'])
        expect(result!.videoCodec).toBe('x265')
        expect(result!.repack).toBe(1)
        expect(result!.proper).toBe(0)
        expect(result!.rerip).toBe(1)
        expect(result!.season).toBe(2)
        expect(result!.episode).toBe(5)
    })
})

describe('defaultFindDuplicates', () => {
    it('returns matching entry as DuplicateEntry with trumpable false', () => {
        const result = defaultFindDuplicates([makeTorrentResult()], baseMetadata)
        expect(result).toEqual([{ name: 'Movie.2024.1080p.BluRay.ENCODE.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])
    })

    it('omits url when url is absent', () => {
        const result = defaultFindDuplicates([makeTorrentResult({ url: undefined })], baseMetadata)
        expect(result[0]!.url).toBeUndefined()
    })

    it('filters out entries where HDR status differs (SDR upload vs HDR result)', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ hdr: ['HDR'] })], { ...baseMetadata, hdr: undefined })).toHaveLength(0)
    })

    it('filters out entries where HDR status differs (HDR upload vs SDR result)', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ hdr: [] })], { ...baseMetadata, hdr: ['HDR'] })).toHaveLength(0)
    })

    it('keeps HDR entry when upload also has HDR', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ hdr: ['HDR'] })], { ...baseMetadata, hdr: ['HDR'] })).toHaveLength(1)
    })

    it('filters out TV entries where season does not match', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ season: 2, episode: 1 })], { ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 1 })).toHaveLength(0)
    })

    it('filters out TV entries where episode does not match', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ season: 1, episode: 3 })], { ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 1 })).toHaveLength(0)
    })

    it('keeps TV entry when season and episode match', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ season: 1, episode: 1 })], { ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 1 })).toHaveLength(1)
    })

    it('does not filter by episode for season packs (episode undefined)', () => {
        expect(defaultFindDuplicates([makeTorrentResult({ season: 1, episode: 0 })], { ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: undefined })).toHaveLength(1)
    })
})
