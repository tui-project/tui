import { beforeEach, describe, expect, it, vi } from 'vitest'

const readFile = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}

vi.mock('node:fs/promises', () => ({
    readFile,
}))

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
})

async function loadService() {
    vi.doMock('h3', () => ({
        createError,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    return import('../../../../server/services/image-upload/imgbb')
}

describe('ImgBB upload provider', () => {
    it('uploads an image and maps the response urls', async () => {
        readFile.mockResolvedValue('base64-data')
        const fetchMock = vi.fn().mockResolvedValue({
            data: {
                url: ' https://full ',
                display_url: ' https://display ',
            },
        })
        vi.stubGlobal('$fetch', fetchMock)
        const { createImgbbImageUploadProvider } = await loadService()

        const provider = createImgbbImageUploadProvider('secret key')

        await expect(provider.uploadImage('/tmp/image.png')).resolves.toEqual({
            url: 'https://full',
            displayUrl: 'https://display',
        })
        expect(fetchMock).toHaveBeenCalledWith('https://api.imgbb.com/1/upload?key=secret%20key', {
            method: 'POST',
            body: expect.any(FormData),
        })
    })

    it('rejects non-200 uploads', async () => {
        readFile.mockResolvedValue('base64-data')
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('HTTP 500')))
        const { createImgbbImageUploadProvider } = await loadService()

        await expect(createImgbbImageUploadProvider('secret').uploadImage('/tmp/image.png')).rejects.toEqual({
            statusCode: 502,
            message: 'image_upload_failed',
        })
    })

    it('rejects payloads without both urls', async () => {
        readFile.mockResolvedValue('base64-data')
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue({
                data: {
                    url: 'https://full',
                    display_url: ' ',
                },
            })
        )
        const { createImgbbImageUploadProvider } = await loadService()

        await expect(createImgbbImageUploadProvider('secret').uploadImage('/tmp/image.png')).rejects.toEqual({
            statusCode: 502,
            message: 'image_upload_failed',
        })
        expect(logger.warn).toHaveBeenCalledWith(
            'ImgBB upload response missing expected URLs.',
            expect.objectContaining({
                filePath: '/tmp/image.png',
                issues: expect.any(Array),
            })
        )
    })

    it('rejects payloads without a data object', async () => {
        readFile.mockResolvedValue('base64-data')
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
        const { createImgbbImageUploadProvider } = await loadService()

        await expect(createImgbbImageUploadProvider('secret').uploadImage('/tmp/image.png')).rejects.toEqual({
            statusCode: 502,
            message: 'image_upload_failed',
        })
    })
})
