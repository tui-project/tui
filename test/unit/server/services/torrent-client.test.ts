import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectTorrent } from '../../../../server/services/torrent-client'

const { fetchMock, logger } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
})

vi.mock('../../../../server/utils/logger', () => ({
    createLogger: () => logger,
}))

function buildClient(overrides: Partial<{ code: string; url: string; apiKey: string }> = {}) {
    return {
        code: 'QUI',
        name: 'qui',
        selected: true,
        url: 'http://qui.local',
        apiKey: 'secret',
        ...overrides,
    }
}

describe('injectTorrent', () => {
    it('returns false and logs a warning for an unsupported client code', async () => {
        const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient({ code: 'UNKNOWN' }))

        expect(result).toBe(false)
        expect(logger.warn).toHaveBeenCalledWith('Unsupported torrent client code, skipping injection.', { code: 'UNKNOWN' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    describe('QUI', () => {
        it('fetches the torrent file and posts it to qui as base64', async () => {
            const torrentBytes = Buffer.from('fake-torrent-content')
            const arrayBuffer = torrentBytes.buffer.slice(torrentBytes.byteOffset, torrentBytes.byteOffset + torrentBytes.byteLength)
            fetchMock.mockResolvedValueOnce(arrayBuffer).mockResolvedValueOnce(undefined)

            const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient())

            expect(result).toBe(true)
            expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://tracker.example.com/torrent/1', { responseType: 'arrayBuffer' })
            expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://qui.local/api/cross-seed/apply', {
                method: 'POST',
                headers: { 'X-API-Key': 'secret' },
                body: {
                    torrentData: torrentBytes.toString('base64'),
                    tags: ['tui'],
                    instanceIds: [1],
                    skipIfExists: true,
                },
            })
            expect(logger.info).toHaveBeenCalledWith('qui injection succeeded.', {
                torrentDownloadUrl: 'https://tracker.example.com/torrent/1',
                quiUrl: 'http://qui.local',
            })
        })

        it('returns false and logs an error when fetching the torrent file fails', async () => {
            const fetchError = new Error('network error')
            fetchMock.mockRejectedValueOnce(fetchError)

            const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient())

            expect(result).toBe(false)
            expect(logger.warn).toHaveBeenCalledWith('qui injection failed.', fetchError, {
                torrentDownloadUrl: 'https://tracker.example.com/torrent/1',
                quiUrl: 'http://qui.local',
            })
        })

        it('returns false and logs an error when the qui API call fails', async () => {
            const apiError = new Error('qui unreachable')
            fetchMock.mockResolvedValueOnce(Buffer.from('data').buffer).mockRejectedValueOnce(apiError)

            const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient())

            expect(result).toBe(false)
            expect(logger.warn).toHaveBeenCalledWith('qui injection failed.', apiError, {
                torrentDownloadUrl: 'https://tracker.example.com/torrent/1',
                quiUrl: 'http://qui.local',
            })
        })
    })
})
