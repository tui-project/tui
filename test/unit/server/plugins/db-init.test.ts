import { describe, expect, it, vi } from 'vitest'

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
            logger,
        }))

        const { default: dbInitPlugin } = await import('../../../../server/plugins/db-init')
        const pluginPromise = dbInitPlugin()

        expect(initDatastores).toHaveBeenCalledTimes(1)
        expect(logger.info).not.toHaveBeenCalled()

        resolveInit?.()
        await pluginPromise

        expect(logger.info).toHaveBeenCalledWith('Database initialised.')
    })
})
