import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTvdbSeries, findTvdbSpecial, findTvdbSpecialRange } from '../../../../server/services/tvdb'

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

const SELECTION_RESPONSE = {
    tvdbId: 311711,
    title: 'The Good Place',
    episodes: [
        { tvdbId: 7359016, seasonNumber: 0, episodeNumber: 3, title: 'The Selection, Part 1: The Mission' },
        { tvdbId: 7359017, seasonNumber: 0, episodeNumber: 4, title: 'The Selection, Part 2: The Candidates' },
        { tvdbId: 7359018, seasonNumber: 0, episodeNumber: 5, title: 'The Selection, Part 3: The Takeout Order' },
        { tvdbId: 7359019, seasonNumber: 0, episodeNumber: 6, title: 'The Selection, Part 4: The Storm Out' },
        { tvdbId: 7359020, seasonNumber: 0, episodeNumber: 7, title: 'The Selection, Part 5: The Talk' },
        { tvdbId: 7359021, seasonNumber: 0, episodeNumber: 8, title: 'The Selection, Part 6: The Solution' },
        { tvdbId: 7569102, seasonNumber: 0, episodeNumber: 9, title: 'Series Finale After Show' },
    ],
}

describe('findTvdbSpecial', () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('matches by episode number with exact title', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 2, 'Polar Challenge')
        expect(result).toEqual({ episodeNumber: 2, title: 'Polar Challenge' })
    })

    it('matches by episode number when no special name provided', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 2)
        expect(result).toEqual({ episodeNumber: 2, title: 'Polar Challenge' })
    })

    it('uses episode number when title is a partial match and no better candidate exists', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        // "Polar" only matches E2 — no better candidate, so episode number wins
        const result = await findTvdbSpecial(74608, 2, 'Polar')
        expect(result).toEqual({ episodeNumber: 2, title: 'Polar Challenge' })
    })

    it('overrides episode number when a different special has a better title match', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        // E1 is "Series 1 Best of", but the title matches E3 "Nepal Special" better
        const result = await findTvdbSpecial(74608, 1, 'Nepal Special')
        expect(result).toEqual({ episodeNumber: 3, title: 'Nepal Special' })
    })

    it('falls back to title matching when episode number is not found', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        // E99 does not exist — fall back to fuzzy title match
        const result = await findTvdbSpecial(74608, 99, 'Nepal')
        expect(result).toEqual({ episodeNumber: 3, title: 'Nepal Special' })
    })

    it('ignores non-season-0 episodes when matching by title', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 99, 'Regular Episode')
        expect(result).toBeNull()
    })

    it('returns null when episode is found by number but has no title and no special name provided', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 74608, title: 'Top Gear', episodes: [{ tvdbId: 150000, seasonNumber: 0, episodeNumber: 1 }] })
        const result = await findTvdbSpecial(74608, 1)
        expect(result).toBeNull()
    })

    it('falls back to specialName as title when episode found by number has no title', async () => {
        fetchMock.mockResolvedValue({
            tvdbId: 74608,
            title: 'Top Gear',
            episodes: [
                { tvdbId: 150000, seasonNumber: 0, episodeNumber: 1 },
                { tvdbId: 339925, seasonNumber: 0, episodeNumber: 2, title: 'Polar Challenge' },
            ],
        })
        const result = await findTvdbSpecial(74608, 1, 'Untitled Special')
        expect(result).toEqual({ episodeNumber: 1, title: 'Untitled Special' })
    })

    it('skips untitled episodes when fuzzy matching', async () => {
        fetchMock.mockResolvedValue({
            tvdbId: 74608,
            title: 'Top Gear',
            episodes: [
                { tvdbId: 150000, seasonNumber: 0, episodeNumber: 1 },
                { tvdbId: 339925, seasonNumber: 0, episodeNumber: 2, title: 'Nepal Special' },
            ],
        })
        const result = await findTvdbSpecial(74608, 99, 'Nepal')
        expect(result).toEqual({ episodeNumber: 2, title: 'Nepal Special' })
    })

    it('returns null when no match found', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        const result = await findTvdbSpecial(74608, 99, 'Completely Unrelated Title')
        expect(result).toBeNull()
    })

    it('returns null when series has no episodes', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 74608, title: 'Top Gear' })
        const result = await findTvdbSpecial(74608, 2, 'Polar Challenge')
        expect(result).toBeNull()
    })

    it('returns null when series has no season 0 episodes', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 74608, title: 'Top Gear', episodes: [{ tvdbId: 500000, seasonNumber: 1, episodeNumber: 1, title: 'Episode 1' }] })
        const result = await findTvdbSpecial(74608, 2, 'Polar Challenge')
        expect(result).toBeNull()
    })

    it('returns null when the request fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        const result = await findTvdbSpecial(74608, 2, 'Polar Challenge')
        expect(result).toBeNull()
    })
})

describe('findTvdbSpecialRange', () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('extracts the shared base title by stripping Part N: suffixes', async () => {
        fetchMock.mockResolvedValue(SELECTION_RESPONSE)
        const result = await findTvdbSpecialRange(311711, 3, 8)
        expect(result).toEqual({ episodeStart: 3, episodeEnd: 8, title: 'The Selection' })
    })

    it('returns the actual first and last episode numbers found in the range', async () => {
        fetchMock.mockResolvedValue(SELECTION_RESPONSE)
        // request a wider range than exists for "The Selection" subset — should clamp to 3–8
        const result = await findTvdbSpecialRange(311711, 3, 8)
        expect(result?.episodeStart).toBe(3)
        expect(result?.episodeEnd).toBe(8)
    })

    it('returns null when no season 0 episodes exist in the requested range', async () => {
        fetchMock.mockResolvedValue(SELECTION_RESPONSE)
        const result = await findTvdbSpecialRange(311711, 20, 25)
        expect(result).toBeNull()
    })

    it('returns a single-episode range correctly when start equals end', async () => {
        fetchMock.mockResolvedValue(SELECTION_RESPONSE)
        const result = await findTvdbSpecialRange(311711, 9, 9)
        expect(result).toEqual({ episodeStart: 9, episodeEnd: 9, title: 'Series Finale After Show' })
    })

    it('returns null when the series fetch fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        const result = await findTvdbSpecialRange(311711, 3, 8)
        expect(result).toBeNull()
    })

    it('returns null when the series has no episodes', async () => {
        fetchMock.mockResolvedValue({ tvdbId: 311711, title: 'The Good Place' })
        const result = await findTvdbSpecialRange(311711, 3, 8)
        expect(result).toBeNull()
    })

    it('ignores non-season-0 episodes when building the range', async () => {
        fetchMock.mockResolvedValue(SPECIALS_RESPONSE)
        // episodeNumber 1 of season 1 ("Regular Episode") should be ignored
        const result = await findTvdbSpecialRange(74608, 1, 3)
        expect(result?.title).not.toBe('Regular Episode')
        expect(result?.episodeEnd).toBe(3)
    })
})
