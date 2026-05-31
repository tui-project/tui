import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { readdir as nodeReaddir, realpath as nodeRealpath, rm, stat as nodeStat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getDirectoryCache = vi.fn<() => Promise<{ path: string; signature: string; items: Array<{ path: string; folder: boolean }> } | null>>()
const saveDirectoryCache = vi.fn<() => Promise<void>>()
const loggerError = vi.fn()
let failSignatureRefreshForPath: string | null = null

async function buildSignature(dirPath: string): Promise<string> {
    const names = await nodeReaddir(dirPath)
    return `${names.length}:${names.sort().join('|')}`
}

describe('directory browse service', () => {
    let rootDir = ''
    let secondRootDir = ''
    let readdirCalls = 0

    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()

        rootDir = mkdtempSync(join(tmpdir(), 'tui-path-repo-'))
        secondRootDir = mkdtempSync(join(tmpdir(), 'tui-path-repo-'))
        mkdirSync(join(rootDir, 'shows'))
        writeFileSync(join(rootDir, 'movie.mkv'), 'x')

        readdirCalls = 0
        getDirectoryCache.mockResolvedValue(null)
        saveDirectoryCache.mockResolvedValue()
        loggerError.mockReset()
        failSignatureRefreshForPath = null
    })

    afterEach(async () => {
        await Promise.all([rm(rootDir, { recursive: true, force: true }), rm(secondRootDir, { recursive: true, force: true })])
    })

    async function loadRepository() {
        vi.doMock('../../../../server/repositories/directory-cache-repository', () => ({
            getDirectoryCache,
            saveDirectoryCache,
        }))
        vi.doMock('../../../../server/utils/logger', () => ({
            logger: {
                debug: vi.fn(),
                trace: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                error: loggerError,
            },
        }))
        vi.doMock('h3', () => ({
            createError: (payload: unknown) => payload,
        }))
        vi.doMock('node:fs/promises', async () => {
            const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
            return {
                ...actual,
                readdir: async (...args: Parameters<typeof nodeReaddir>) => {
                    readdirCalls += 1
                    if (failSignatureRefreshForPath && args[0] === failSignatureRefreshForPath) {
                        throw new Error('refresh-signature-failed')
                    }
                    return nodeReaddir(...args)
                },
                stat: (...args: Parameters<typeof nodeStat>) => nodeStat(...args),
                realpath: (...args: Parameters<typeof nodeRealpath>) => nodeRealpath(...args),
            }
        })

        return import('../../../../server/services/directory-browse')
    }

    it('returns persisted cache immediately and skips async write when signature is unchanged', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        const signature = await buildSignature(resolvedRoot)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature,
            items: [{ path: join(resolvedRoot, 'cached.mkv'), folder: false }],
        })

        const { listChildren } = await loadRepository()
        await expect(listChildren(rootDir)).resolves.toEqual([{ path: join(resolvedRoot, 'cached.mkv'), folder: false }])

        await new Promise((resolve) => setTimeout(resolve, 0))
        // 1 readdir for async signature check (cache hit, no save)
        expect(readdirCalls).toBe(1)
        expect(saveDirectoryCache).not.toHaveBeenCalled()
    })

    it('loads and persists data when cache is missing', async () => {
        const { listChildren } = await loadRepository()

        await listChildren(rootDir)
        // 1 for signature + 1 for loadChildren
        expect(readdirCalls).toBe(2)
        expect(saveDirectoryCache).toHaveBeenCalledTimes(1)
    })

    it('logs when async refresh fails', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature: 'stale-signature',
            items: [{ path: join(resolvedRoot, 'stale.mkv'), folder: false }],
        })
        failSignatureRefreshForPath = resolvedRoot

        const { listChildren } = await loadRepository()
        await expect(listChildren(rootDir)).resolves.toEqual([{ path: join(resolvedRoot, 'stale.mkv'), folder: false }])

        await vi.waitFor(() => {
            expect(loggerError).toHaveBeenCalledWith('Failed to refresh directory cache.', expect.any(Error))
        })
        expect(saveDirectoryCache).not.toHaveBeenCalled()
    })

    it('returns stale cached data and refreshes asynchronously when signature changes', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature: 'stale-signature',
            items: [{ path: join(resolvedRoot, 'stale.mkv'), folder: false }],
        })

        const { listChildren } = await loadRepository()

        await expect(listChildren(rootDir)).resolves.toEqual([{ path: join(resolvedRoot, 'stale.mkv'), folder: false }])

        await vi.waitFor(() => {
            // 1 for signature + 1 for loadChildren (signature changed)
            expect(readdirCalls).toBe(2)
            expect(saveDirectoryCache).toHaveBeenCalledTimes(1)
        })
    })
})
