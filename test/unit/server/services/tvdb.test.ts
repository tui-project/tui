import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTvdbSeries, findTvdbSpecial } from '../../../../server/services/tvdb'

vi.mock('../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

describe('getTvdbSeries', () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('returns series data from SkyHook', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 81189, title: 'Breaking Bad' })
        const result = await getTvdbSeries(81189)
        expect(result).toEqual({ tvdbId: 81189, title: 'Breaking Bad' })
        expect(fetchMock).toHaveBeenCalledWith('https://skyhook.sonarr.tv/v1/tvdb/shows/en/81189')
    })

    it('returns series with year qualifier in title', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 999, title: 'Top Gear (1978)' })
        const result = await getTvdbSeries(999)
        expect(result?.title).toBe('Top Gear (1978)')
    })

    it('returns null when the request fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        const result = await getTvdbSeries(99999)
        expect(result).toBeNull()
    })

    it('returns null when the request fails with a non-Error object', async () => {
        fetchMock.mockRejectedValue('unexpected string error')
        const result = await getTvdbSeries(99999)
        expect(result).toBeNull()
    })

    it('returns null when the request fails with an object missing typed fields', async () => {
        fetchMock.mockRejectedValue({ name: 42, message: true, statusCode: 'bad' })
        const result = await getTvdbSeries(99999)
        expect(result).toBeNull()
    })

    it('returns null when the request fails with an object with valid fields', async () => {
        fetchMock.mockRejectedValue({ name: 'FetchError', message: 'Not Found', statusCode: 404 })
        const result = await getTvdbSeries(99999)
        expect(result).toBeNull()
    })
})

const SPECIALS_RESPONSE = {
    tvdbId: 74608,
    title: 'Top Gear',
    episodes: [
        { tvdbId: 150000, seasonNumber: 0, episodeNumber: 1, title: 'Series 1 Best of' },
        { tvdbId: 339925, seasonNumber: 0, episodeNumber: 2, title: 'Polar Challenge' },
        { tvdbId: 400000, seasonNumber: 0, episodeNumber: 3, title: 'Nepal Special' },
        { tvdbId: 500000, seasonNumber: 1, episodeNumber: 1, title: 'Regular Episode' },
    ],
}

describe('findTvdbSpecial', () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('returns exact match from season 0 episodes', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 'Polar Challenge')
        expect(result).toEqual({ episodeNumber: 2, title: 'Polar Challenge' })
    })

    it('returns fuzzy match when exact title not found', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 'Nepal')
        expect(result).toEqual({ episodeNumber: 3, title: 'Nepal Special' })
    })

    it('ignores non-season-0 episodes when matching', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 'Regular Episode')
        expect(result).toBeNull()
    })

    it('returns null when no match found', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 'Completely Unrelated Title')
        expect(result).toBeNull()
    })

    it('returns null when series has no episodes', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 74608, title: 'Top Gear' })
        const result = await findTvdbSpecial(74608, 'Polar Challenge')
        expect(result).toBeNull()
    })

    it('returns null when series has no season 0 episodes', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 74608, title: 'Top Gear', episodes: [{ tvdbId: 500000, seasonNumber: 1, episodeNumber: 1, title: 'Episode 1' }] })
        const result = await findTvdbSpecial(74608, 'Polar Challenge')
        expect(result).toBeNull()
    })

    it('returns null when the request fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        const result = await findTvdbSpecial(74608, 'Polar Challenge')
        expect(result).toBeNull()
    })
})
