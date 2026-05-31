import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

const removeAsyncMock = vi.fn().mockResolvedValue(0)
const insertAsyncMock = vi.fn().mockResolvedValue({})
const updateAsyncMock = vi.fn().mockResolvedValue({})
let findOneResult: unknown = null
const getLanguagesMock = vi.fn()

vi.mock('../../../../server/utils/db', () => ({
    languageCollection: {
        removeAsync: removeAsyncMock,
        insertAsync: insertAsyncMock,
        updateAsync: updateAsyncMock,
        findOneAsync: vi.fn(async () => findOneResult),
    },
}))

vi.mock('../../../../server/services/tmdb', () => ({
    getLanguages: getLanguagesMock,
}))

beforeEach(() => {
    vi.resetModules()
    getLanguagesMock.mockReset()
    removeAsyncMock.mockReset().mockResolvedValue(0)
    insertAsyncMock.mockReset().mockResolvedValue({})
    updateAsyncMock.mockReset().mockResolvedValue({})
    findOneResult = null
})

afterEach(() => {
    vi.clearAllMocks()
})

async function loadRepository() {
    vi.doMock('../../../../server/utils/db', () => ({
        languageCollection: {
            removeAsync: removeAsyncMock,
            insertAsync: insertAsyncMock,
            updateAsync: updateAsyncMock,
            findOneAsync: vi.fn(async () => findOneResult),
        },
    }))
    vi.doMock('../../../../server/services/tmdb', () => ({
        getLanguages: getLanguagesMock,
    }))
    return import('../../../../server/repositories/language-repository')
}

describe('language repository — refreshLanguages', () => {
    it('fetches languages from TMDB, clears old entries, and inserts new ones', async () => {
        getLanguagesMock.mockResolvedValue([
            { iso_639_1: 'fr', english_name: 'French' },
            { iso_639_1: 'ja', english_name: 'Japanese' },
        ])
        const { refreshLanguages } = await loadRepository()

        await refreshLanguages()

        expect(removeAsyncMock).toHaveBeenCalledOnce()
        expect(insertAsyncMock).toHaveBeenCalledOnce()
        expect(updateAsyncMock).toHaveBeenCalledOnce()
    })

    it('updates the sentinel refreshedAt timestamp on success', async () => {
        getLanguagesMock.mockResolvedValue([{ iso_639_1: 'fr', english_name: 'French' }])
        const { refreshLanguages } = await loadRepository()

        await refreshLanguages()

        expect(updateAsyncMock).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'meta' }),
            expect.objectContaining({ $set: expect.objectContaining({ refreshedAt: expect.any(Date) }) }),
            { upsert: true }
        )
    })

    it('does not clear or insert when TMDB returns null', async () => {
        getLanguagesMock.mockResolvedValue(null)
        const { refreshLanguages } = await loadRepository()

        await refreshLanguages()

        expect(removeAsyncMock).not.toHaveBeenCalled()
        expect(insertAsyncMock).not.toHaveBeenCalled()
        expect(updateAsyncMock).not.toHaveBeenCalled()
    })

    it('does not throw when TMDB returns null', async () => {
        getLanguagesMock.mockResolvedValue(null)
        const { refreshLanguages } = await loadRepository()

        await expect(refreshLanguages()).resolves.toBeUndefined()
    })
})

describe('language repository — getLanguageDisplayName', () => {
    it('returns the english_name for a known language code', async () => {
        findOneResult = { iso_639_1: 'fr', english_name: 'French' }
        const { getLanguageDisplayName } = await loadRepository()

        await expect(getLanguageDisplayName('fr')).resolves.toBe('French')
    })

    it('returns null for an unknown language code', async () => {
        findOneResult = null
        const { getLanguageDisplayName } = await loadRepository()

        await expect(getLanguageDisplayName('xx')).resolves.toBeNull()
    })

    it('triggers a background refresh when sentinel is missing', async () => {
        getLanguagesMock.mockResolvedValue([])
        findOneResult = null
        const { getLanguageDisplayName } = await loadRepository()

        await getLanguageDisplayName('fr')

        await vi.waitFor(() => expect(getLanguagesMock).toHaveBeenCalled())
    })

    it('triggers a background refresh when data is older than 30 days', async () => {
        getLanguagesMock.mockResolvedValue([])
        const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
        findOneResult = { _id: 'meta', refreshedAt: thirtyOneDaysAgo }
        const { getLanguageDisplayName } = await loadRepository()

        await getLanguageDisplayName('fr')

        await vi.waitFor(() => expect(getLanguagesMock).toHaveBeenCalled())
    })

    it('does not trigger a refresh when data is fresh', async () => {
        findOneResult = { _id: 'meta', refreshedAt: new Date() }
        const { getLanguageDisplayName } = await loadRepository()

        await getLanguageDisplayName('fr')

        expect(getLanguagesMock).not.toHaveBeenCalled()
    })
})
