import { beforeEach, describe, expect, it, vi } from 'vitest'

const createImgbbImageUploadProvider = vi.fn()
const getSettings = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
})

async function loadService() {
    vi.doMock('../../../../server/services/image-upload/imgbb', () => ({
        createImgbbImageUploadProvider,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))
    vi.doMock('h3', () => ({
        createError,
    }))

    return import('../../../../server/services/image-upload/provider')
}

describe('image upload provider factory', () => {
    it('creates an ImgBB provider with the trimmed API key', async () => {
        const provider = { uploadImage: vi.fn() }
        getSettings.mockResolvedValue({ imageHostProviders: ['imgbb'], imgbbApiKey: '  secret-key  ' })
        createImgbbImageUploadProvider.mockReturnValue(provider)
        const { createImageUploadProvider } = await loadService()

        await expect(createImageUploadProvider()).resolves.toBe(provider)
        expect(createImgbbImageUploadProvider).toHaveBeenCalledWith('secret-key')
    })

    it('rejects when the API key is missing', async () => {
        getSettings.mockResolvedValue({ imageHostProviders: ['imgbb'], imgbbApiKey: '   ' })
        const { createImageUploadProvider } = await loadService()

        await expect(createImageUploadProvider()).rejects.toEqual({
            statusCode: 400,
            message: 'missing_imgbb_api_key',
        })
        expect(logger.warn).toHaveBeenCalledWith('Image upload provider could not be created because ImgBB API key is missing.')
    })

    it('rejects when no image host provider is enabled', async () => {
        getSettings.mockResolvedValue({ imageHostProviders: [], imgbbApiKey: 'secret-key' })
        const { createImageUploadProvider } = await loadService()

        await expect(createImageUploadProvider()).rejects.toEqual({
            statusCode: 400,
            message: 'missing_image_host_provider',
        })
        expect(logger.warn).toHaveBeenCalledWith('Image upload provider could not be created because no image host provider is enabled.')
    })
})
