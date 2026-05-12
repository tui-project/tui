import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTvdbSeries } from '../../../../server/services/tvdb'

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
