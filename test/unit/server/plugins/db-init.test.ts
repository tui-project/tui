import { mkdtempSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getDataDir } from '../../setupFile'

describe('db init plugin', () => {
    it('waits for datastore initialization before logging success', async () => {
        vi.resetModules()

        const initDatastores = vi.fn()
        const logger = {
            info: vi.fn(),
        }

        let resolveInit: (() => void) | undefined
        initDatastores.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveInit = resolve
                })
        )

        vi.doMock('nitropack/runtime', () => ({
            defineNitroPlugin: vi.fn((plugin) => plugin),
        }))

        vi.doMock('../../../../server/utils/db', () => ({
            initDatastores,
        }))

        vi.doMock('../../../../server/utils/logger', () => ({
            createLogger: () => logger,
        }))

        const { default: dbInitPlugin } = await import('../../../../server/plugins/db-init')
        const obsoleteDatafile = join(getDataDir(), 'languages.db')
        await writeFile(obsoleteDatafile, 'cached languages')
        const pluginPromise = dbInitPlugin()

        expect(initDatastores).toHaveBeenCalledTimes(1)
        expect(logger.info).not.toHaveBeenCalled()

        resolveInit?.()
        await pluginPromise

        await expect(stat(obsoleteDatafile)).rejects.toMatchObject({ code: 'ENOENT' })
        expect(logger.info).toHaveBeenCalledWith('Database initialised.')
    })

    it('removes the obsolete datastore from the default database directory', async () => {
        vi.resetModules()

        const originalCwd = process.cwd()
        const configuredDataDir = getDataDir()
        const tempCwd = mkdtempSync(join(tmpdir(), 'tui-db-init-'))
        const defaultDataDir = join(tempCwd, 'config', 'database')
        const obsoleteDatafile = join(defaultDataDir, 'languages.db')

        vi.doMock('nitropack/runtime', () => ({
            defineNitroPlugin: vi.fn((plugin) => plugin),
        }))
        vi.doMock('../../../../server/utils/db', () => ({
            initDatastores: vi.fn().mockResolvedValue(undefined),
        }))
        vi.doMock('../../../../server/utils/logger', () => ({
            createLogger: () => ({ info: vi.fn() }),
        }))

        try {
            delete process.env.DATABASE_DIR
            process.chdir(tempCwd)
            await mkdir(defaultDataDir, { recursive: true })
            await writeFile(obsoleteDatafile, 'cached languages')

            const { default: dbInitPlugin } = await import('../../../../server/plugins/db-init')
            await dbInitPlugin()

            await expect(stat(obsoleteDatafile)).rejects.toMatchObject({ code: 'ENOENT' })
        } finally {
            process.chdir(originalCwd)
            process.env.DATABASE_DIR = configuredDataDir
            await rm(tempCwd, { recursive: true, force: true })
        }
    })
})
