import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { upload } from '../../../../../server/services/tracker/unit3d-tracker'
import { MEDIA_TYPES, SOURCE_TYPES, SOURCES, RESOLUTIONS } from '../../../../../server/model/metadata'
import { TrackerError, type TrackerUploadMetadata, type TrackerUploadOptions } from '../../../../../server/services/tracker/tracker'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
