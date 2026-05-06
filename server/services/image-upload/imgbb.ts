import { readFile } from 'node:fs/promises'
import { createError } from 'h3'
import { logger } from '../../utils/logger'
import type { ImageUploadProvider, UploadedImage } from './types'

interface ImgbbResponse {
    data?: {
        url?: string
        display_url?: string
    }
    success?: boolean
}

export function createImgbbImageUploadProvider(apiKey: string): ImageUploadProvider {
    async function uploadImage(filePath: string): Promise<UploadedImage> {
        logger.trace('Uploading image to ImgBB.', { filePath })
        const image = await readFile(filePath, { encoding: 'base64' })
        const formData = new FormData()
        formData.set('image', image)

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            logger.warn('ImgBB upload failed.', { status: response.status, filePath })
            throw createError({
                statusCode: 502,
                message: 'image_upload_failed',
            })
        }

        const payload = (await response.json()) as ImgbbResponse
        const url = payload.data?.url?.trim() ?? ''
        const displayUrl = payload.data?.display_url?.trim() ?? ''

        if (!url || !displayUrl) {
            logger.warn('ImgBB upload response missing expected URLs.', { filePath })
            throw createError({
                statusCode: 502,
                message: 'image_upload_failed',
            })
        }

        logger.debug('Image uploaded to ImgBB.', { filePath })
        return {
            url,
            displayUrl,
        }
    }

    return {
        uploadImage,
    }
}
