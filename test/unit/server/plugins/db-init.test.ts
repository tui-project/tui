import { describe, expect, it, vi } from 'vitest'

describe('db init plugin', () => {
    it('waits for datastore initialization before logging success', async () => {
        vi.resetModules()

        const initDatastores = vi.fn()
        const refreshLanguages = vi.fn().mockResolvedValue(undefined)
        const backfillTrackerRequestGroupIds = vi.fn().mockResolvedValue(undefined)
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

        vi.doMock('../../../../server/repositories/language-repository', () => ({
            refreshLanguages,
        }))

        vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
            backfillTrackerRequestGroupIds,
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

        expect(backfillTrackerRequestGroupIds).toHaveBeenCalledWith()
        expect(logger.info).toHaveBeenCalledWith('Database initialised.')
    })
})
