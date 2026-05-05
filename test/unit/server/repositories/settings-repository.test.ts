import { describe, expect, it, vi } from 'vitest'

describe('settings repository', () => {
    it('returns empty settings before settings are saved', async () => {
        const { getSettings } = await import('../../../../server/repositories/settings-repository')
        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: [],
            tmdbApiKey: '',
        })
    })

    it('saves and returns settings', async () => {
        const { getSettings, saveSettings } = await import('../../../../server/repositories/settings-repository')
        await saveSettings({ mediaPaths: ['/media/a', '/media/b'], tmdbApiKey: 'abc' })

        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: ['/media/a', '/media/b'],
            tmdbApiKey: 'abc',
        })
    })

    it('overwrites settings on save', async () => {
        const { getSettings, saveSettings } = await import('../../../../server/repositories/settings-repository')
        await saveSettings({ mediaPaths: ['/media/old'], tmdbApiKey: 'old' })
        await saveSettings({ mediaPaths: ['/media/new'], tmdbApiKey: 'new' })

        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: ['/media/new'],
            tmdbApiKey: 'new',
        })
    })

    it('logs initialization error when default settings initialization fails', async () => {
        vi.resetModules()

        const logger = {
            info: vi.fn(),
            error: vi.fn(),
        }

        vi.doMock('../../../../server/utils/logger', () => ({
            logger,
        }))

        vi.doMock('../../../../server/utils/db', () => ({
            initDatastores: vi.fn().mockResolvedValue(undefined),
            settingsCollection: {
                findOneAsync: vi.fn().mockRejectedValue(new Error('init failure')),
                insertAsync: vi.fn(),
                updateAsync: vi.fn(),
            },
        }))

        await import('../../../../server/repositories/settings-repository')
        await Promise.resolve()
        await Promise.resolve()

        expect(logger.error).toHaveBeenCalledWith('Failed to initialize default settings.', expect.any(Error))
    })
})
