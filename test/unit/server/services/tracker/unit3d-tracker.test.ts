import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUnit3dService } from '../../../../../server/services/tracker/unit3d-tracker'
import { MEDIA_TYPES, SOURCE_TYPES, SOURCES, RESOLUTIONS } from '../../../../../server/model/metadata'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'

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
    rerip: false,
    threeD: false,
    hybrid: false,
    resolution: RESOLUTIONS['1080p'],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

beforeEach(() => {
    readFileMock.mockResolvedValue(Buffer.from('torrent-data') as never)
})

describe('createUnit3dService — getTitle', () => {
    it('returns empty string when no buildTitle is provided', async () => {
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        expect(await service.getTitle(baseMetadata)).toBe('')
    })

    it('uses a custom buildTitle function when provided', async () => {
        const customTitle = vi.fn().mockResolvedValue('CUSTOM')
        const customService = createUnit3dService('https://tracker.example.com', 'apikey', customTitle)
        expect(await customService.getTitle(baseMetadata)).toBe('CUSTOM')
        expect(customTitle).toHaveBeenCalledWith(baseMetadata)
    })
})

describe('createUnit3dService — upload', () => {
    beforeEach(() => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))
    })

    it('reads the torrent file and logs upload info', async () => {
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(service.upload('/path/to/movie.torrent', baseMetadata, 'description', 'mediainfo text', { title: 'Movie Title', anonymous: false })).resolves.toBeUndefined()
        expect(readFileMock).toHaveBeenCalledWith('/path/to/movie.torrent')
    })

    it('includes optional tvdbId, season, and episode in form data when present', async () => {
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(
            service.upload('/path/to/movie.torrent', { ...baseMetadata, tvdbId: 99, season: 2, episode: 5 }, 'desc', 'mi', { title: 'T', anonymous: true })
        ).resolves.toBeUndefined()
    })

    it('strips tt prefix from imdbId', async () => {
        readFileMock.mockResolvedValue(Buffer.from('data') as never)
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload('/path/to/movie.torrent', { ...baseMetadata, imdbId: 'tt9876543' }, 'desc', 'mi', { title: 'T', anonymous: false })
        expect(appendSpy).toHaveBeenCalledWith('imdb', '9876543')
    })

    it('passes imdbId unchanged when tt prefix is absent', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload('/path/to/movie.torrent', { ...baseMetadata, imdbId: '1234567' }, 'desc', 'mi', { title: 'T', anonymous: false })
        expect(appendSpy).toHaveBeenCalledWith('imdb', '1234567')
    })

    it('appends anonymous as string "true" when anonymous is true', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload('/path/to/movie.torrent', baseMetadata, 'desc', 'mi', { title: 'T', anonymous: true })
        expect(appendSpy).toHaveBeenCalledWith('anonymous', 'true')
    })

    it('appends correct category_id, type_id, and resolution_id for movie encode 1080p', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload(
            '/path/to/movie.torrent',
            { ...baseMetadata, mediaType: MEDIA_TYPES.MOVIE, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['1080p'] },
            'desc',
            'mi',
            { title: 'T', anonymous: false }
        )
        expect(appendSpy).toHaveBeenCalledWith('category_id', '1')
        expect(appendSpy).toHaveBeenCalledWith('type_id', '3')
        expect(appendSpy).toHaveBeenCalledWith('resolution_id', '3')
    })

    it('appends correct category_id for TV and type_id for REMUX', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload(
            '/path/to/movie.torrent',
            { ...baseMetadata, mediaType: MEDIA_TYPES.TV, sourceType: SOURCE_TYPES.REMUX, resolution: RESOLUTIONS['2160p'] },
            'desc',
            'mi',
            { title: 'T', anonymous: false }
        )
        expect(appendSpy).toHaveBeenCalledWith('category_id', '2')
        expect(appendSpy).toHaveBeenCalledWith('type_id', '2')
        expect(appendSpy).toHaveBeenCalledWith('resolution_id', '2')
    })

    it('appends tmdb id as string', async () => {
        const appendSpy = vi.spyOn(FormData.prototype, 'append')
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await service.upload('/path/to/movie.torrent', { ...baseMetadata, tmdbId: 42 }, 'desc', 'mi', { title: 'T', anonymous: false })
        expect(appendSpy).toHaveBeenCalledWith('tmdb', '42')
    })

    it('throws when $fetch rejects with an Error', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('422 Unprocessable Entity')))
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(service.upload('/path/to/movie.torrent', baseMetadata, 'desc', 'mi', { title: 'T', anonymous: false })).rejects.toThrow(
            'Upload failed: 422 Unprocessable Entity'
        )
    })

    it('throws when $fetch rejects with a non-Error value', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue('Internal Server Error'))
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(service.upload('/path/to/movie.torrent', baseMetadata, 'desc', 'mi', { title: 'T', anonymous: false })).rejects.toThrow(
            'Upload failed: Internal Server Error'
        )
    })
})
