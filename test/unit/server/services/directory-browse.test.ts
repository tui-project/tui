import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { readdir as nodeReaddir, realpath as nodeRealpath, rm, stat as nodeStat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getDirectoryCache = vi.fn<() => Promise<{ path: string; signature: string; items: Array<{ path: string; folder: boolean }> } | null>>()
const saveDirectoryCache = vi.fn<() => Promise<void>>()
const loggerWarn = vi.fn()

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
        loggerWarn.mockReset()
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
            createLogger: () => ({
                debug: vi.fn(),
                trace: vi.fn(),
                warn: loggerWarn,
                info: vi.fn(),
                error: vi.fn(),
            }),
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
                    return nodeReaddir(...args)
                },
                stat: (...args: Parameters<typeof nodeStat>) => nodeStat(...args),
                realpath: (...args: Parameters<typeof nodeRealpath>) => nodeRealpath(...args),
            }
        })

        return import('../../../../server/services/directory-browse')
    }

    it('returns persisted cache immediately and skips write when signature is unchanged', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        const signature = await buildSignature(resolvedRoot)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature,
            items: [{ path: join(resolvedRoot, 'cached.mkv'), folder: false }],
        })

        const { listChildren } = await loadRepository()
        await expect(listChildren(rootDir)).resolves.toEqual([{ path: join(resolvedRoot, 'cached.mkv'), folder: false }])

        // 1 readdir for signature check only (cache hit, no reload, no save)
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

    it('returns fresh data immediately and updates cache asynchronously when signature changes', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature: 'stale-signature',
            items: [{ path: join(resolvedRoot, 'stale.mkv'), folder: false }],
        })

        const { listChildren } = await loadRepository()

        await expect(listChildren(rootDir)).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: join(resolvedRoot, 'movie.mkv'), folder: false }),
                expect.objectContaining({ path: join(resolvedRoot, 'shows'), folder: true }),
            ])
        )
        // 1 for signature + 1 for loadChildren (signature changed)
        expect(readdirCalls).toBe(2)

        await vi.waitFor(() => {
            expect(saveDirectoryCache).toHaveBeenCalledTimes(1)
        })
    })

    it('logs when async cache update fails', async () => {
        const resolvedRoot = await nodeRealpath(rootDir)
        getDirectoryCache.mockResolvedValue({
            path: resolvedRoot,
            signature: 'stale-signature',
            items: [{ path: join(resolvedRoot, 'stale.mkv'), folder: false }],
        })
        saveDirectoryCache.mockRejectedValue(new Error('save-failed'))

        const { listChildren } = await loadRepository()

        await listChildren(rootDir)

        await vi.waitFor(() => {
            expect(loggerWarn).toHaveBeenCalledWith('Failed to update directory cache.', expect.any(Error))
        })
    })

    it('logs when async cache creation fails after a cache miss', async () => {
        saveDirectoryCache.mockRejectedValue(new Error('save-failed'))

        const { listChildren } = await loadRepository()

        await listChildren(rootDir)

        await vi.waitFor(() => {
            expect(loggerWarn).toHaveBeenCalledWith('Failed to update directory cache.', expect.any(Error))
        })
    })
})
