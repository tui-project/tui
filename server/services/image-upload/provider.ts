import { createImgbbImageUploadProvider } from './imgbb'
import { createError } from 'h3'
import { getSettings } from '../../repositories/settings-repository'
import { logger } from '../../utils/logger'
import type { ImageUploadProvider } from './types'

export async function createImageUploadProvider(): Promise<ImageUploadProvider> {
    logger.trace('Creating image upload provider.')

    const settings = await getSettings()
    const imgbbSettings = settings.imageHostProviders.find((provider) => provider.code === 'imgbb' && provider.selected)
    const apiKey = imgbbSettings?.apiKey?.trim() ?? ''

    if (!imgbbSettings) {
        logger.warn('Image upload provider could not be created because no image host provider is enabled.')
        throw createError({
            statusCode: 400,
            message: 'missing_image_host_provider',
        })
    }

    if (!apiKey) {
        logger.warn('Image upload provider could not be created because ImgBB API key is missing.')
        throw createError({
            statusCode: 400,
            message: 'missing_imgbb_api_key',
        })
    }

    logger.debug('Image upload provider created.', { provider: 'imgbb' })

    return createImgbbImageUploadProvider(apiKey)
}
