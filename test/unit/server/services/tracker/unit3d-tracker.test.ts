import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUnit3dService } from '../../../../../server/services/tracker/unit3d-tracker'
import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, SOURCES } from '../../../../../server/model/metadata'
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
    repack: false,
    proper: false,
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

describe('createUnit3dService — getTitle (default getCommonTitle)', () => {
    const service = createUnit3dService('https://tracker.example.com', 'apikey')

    it('builds a basic movie title', () => {
        expect(service.getTitle(baseMetadata)).toBe('Movie (2024) 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP')
    })

    it('includes TV season and episode when present', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 3 })
        expect(title).toContain('S01E03')
    })

    it('includes season only when episode is absent', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 2 })
        expect(title).toContain('S02')
        expect(title).not.toMatch(/S\d+E/)
    })

    it('includes PROPER and REPACK flags', () => {
        const title = service.getTitle({ ...baseMetadata, proper: true, repack: true })
        expect(title).toContain('PROPER')
        expect(title).toContain('REPACK')
    })

    it('includes HYBRiD flag', () => {
        const title = service.getTitle({ ...baseMetadata, hybrid: true })
        expect(title).toContain('HYBRiD')
    })

    it('uses streaming service name for WEB source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('AMZN')
    })

    it('omits service for non-WEB source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY })
        expect(title).not.toContain('AMZN')
    })

    it('includes HDR tags', () => {
        const title = service.getTitle({ ...baseMetadata, hdr: ['HDR10', 'DV'] })
        expect(title).toContain('HDR10')
        expect(title).toContain('DV')
    })

    it('includes cut when present', () => {
        const title = service.getTitle({ ...baseMetadata, cut: "Director's Cut" })
        expect(title).toContain("Director's Cut")
    })

    it('includes audioMetadata when present', () => {
        const title = service.getTitle({ ...baseMetadata, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('omits release group suffix when releaseGroup is absent', () => {
        const title = service.getTitle({ ...baseMetadata, releaseGroup: undefined })
        expect(title).not.toContain('-GROUP')
        expect(title).not.toMatch(/-$/)
    })

    it('uses a custom buildTitle function when provided', () => {
        const customTitle = vi.fn().mockReturnValue('CUSTOM')
        const customService = createUnit3dService('https://tracker.example.com', 'apikey', customTitle)
        expect(customService.getTitle(baseMetadata)).toBe('CUSTOM')
        expect(customTitle).toHaveBeenCalledWith(baseMetadata)
    })
})

describe('createUnit3dService — upload', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
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

    it('throws with JSON error detail when response is not ok and body is valid JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 422,
                json: vi.fn().mockResolvedValue({ message: 'Validation failed' }),
            })
        )
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(service.upload('/path/to/movie.torrent', baseMetadata, 'desc', 'mi', { title: 'T', anonymous: false })).rejects.toThrow('Upload failed with status 422')
    })

    it('throws with text error detail when response is not ok and body is not valid JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: vi.fn().mockRejectedValue(new Error('not json')),
                text: vi.fn().mockResolvedValue('Internal Server Error'),
            })
        )
        const service = createUnit3dService('https://tracker.example.com', 'apikey')
        await expect(service.upload('/path/to/movie.torrent', baseMetadata, 'desc', 'mi', { title: 'T', anonymous: false })).rejects.toThrow(
            'Upload failed with status 500: Internal Server Error'
        )
    })
})
