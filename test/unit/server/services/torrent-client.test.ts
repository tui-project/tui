import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}

const fetchMock = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
})

vi.mock('../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

async function loadModule() {
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    return import('../../../../server/services/torrent-client')
}

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
        const { injectTorrent } = await loadModule()

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

            const { injectTorrent } = await loadModule()
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

            const { injectTorrent } = await loadModule()
            const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient())

            expect(result).toBe(false)
            expect(logger.error).toHaveBeenCalledWith('qui injection failed.', fetchError, {
                torrentDownloadUrl: 'https://tracker.example.com/torrent/1',
                quiUrl: 'http://qui.local',
            })
        })

        it('returns false and logs an error when the qui API call fails', async () => {
            const apiError = new Error('qui unreachable')
            fetchMock.mockResolvedValueOnce(Buffer.from('data').buffer).mockRejectedValueOnce(apiError)

            const { injectTorrent } = await loadModule()
            const result = await injectTorrent('https://tracker.example.com/torrent/1', buildClient())

            expect(result).toBe(false)
            expect(logger.error).toHaveBeenCalledWith('qui injection failed.', apiError, {
                torrentDownloadUrl: 'https://tracker.example.com/torrent/1',
                quiUrl: 'http://qui.local',
            })
        })
    })
})
