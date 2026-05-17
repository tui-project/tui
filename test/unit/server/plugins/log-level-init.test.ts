import { describe, expect, it, vi } from 'vitest'

describe('log level init plugin', () => {
    it('applies the saved log level from settings', async () => {
        vi.resetModules()

        const getSettings = vi.fn().mockResolvedValue({ logLevel: 4 })
        const setLogLevel = vi.fn()

        vi.doMock('nitropack/runtime', () => ({
            defineNitroPlugin: vi.fn((plugin) => plugin),
        }))

        vi.doMock('../../../../server/repositories/settings-repository', () => ({
            getSettings,
        }))

        vi.doMock('../../../../server/utils/logger', () => ({
            setLogLevel,
        }))

        const { default: logLevelInitPlugin } = await import('../../../../server/plugins/log-level-init')
        await logLevelInitPlugin()

        expect(setLogLevel).toHaveBeenCalledWith(4)
    })
})
