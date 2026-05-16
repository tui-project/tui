import { readFile } from 'node:fs/promises'
import { createError } from 'h3'
import { z } from 'zod'
import { logger } from '../../utils/logger'
import type { ImageUploadProvider, UploadedImage } from './types'

const imgbbResponseSchema = z.object({
    data: z.object({
        url: z.string().trim().min(1),
        display_url: z.string().trim().min(1),
    }),
})

export function createImgbbImageUploadProvider(apiKey: string): ImageUploadProvider {
    async function uploadImage(filePath: string): Promise<UploadedImage> {
        logger.trace('Uploading image to ImgBB.', { filePath })

        const image = await readFile(filePath, { encoding: 'base64' })
        const formData = new FormData()
        formData.set('image', image)

        let payload: unknown
        try {
            payload = await $fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                body: formData,
            })
        } catch (err) {
            logger.warn('ImgBB upload failed.', { filePath, err })
            throw createError({
                statusCode: 502,
                message: 'image_upload_failed',
            })
        }

        const result = imgbbResponseSchema.safeParse(payload)

        if (!result.success) {
            logger.warn('ImgBB upload response missing expected URLs.', { filePath, issues: result.error.issues })
            throw createError({
                statusCode: 502,
                message: 'image_upload_failed',
            })
        }

        const { url, display_url: displayUrl } = result.data.data

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
