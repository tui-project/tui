import { stat } from 'node:fs/promises'
import { createError } from 'h3'
import { z } from 'zod'
import { getSettings, saveSettings } from '../repositories/settings-repository'
import { logger, setLogLevel } from '../utils/logger'
import { parseValidatedBody } from '../utils/request-validator'
import { toSettingsResponse } from './settings-response'

const imageHostProviderSchema = z
    .object({
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        selected: z.boolean(),
        apiKey: z.string().trim().min(1).optional(),
    })
    .superRefine((provider, context) => {
        if (provider.selected && !provider.apiKey) {
            context.addIssue({
                code: 'custom',
                path: ['apiKey'],
                message: 'apiKey is required when provider is selected',
            })
        }
    })
    .transform((provider) => ({
        ...provider,
        url: '',
    }))

const trackerSchema = z
    .object({
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        selected: z.boolean(),
        apiKey: z.string().trim().min(1).optional(),
        passKey: z.string().trim().min(1).optional(),
    })
    .superRefine((tracker, context) => {
        if (tracker.selected && !tracker.apiKey) {
            context.addIssue({
                code: 'custom',
                path: ['apiKey'],
                message: 'apiKey is required when tracker is selected',
            })
        }

        if (tracker.selected && !tracker.passKey) {
            context.addIssue({
                code: 'custom',
                path: ['passKey'],
                message: 'passKey is required when tracker is selected',
            })
        }
    })
    .transform((tracker) => ({
        ...tracker,
        url: '',
    }))

const settingsRequestSchema = z.object({
    mediaPaths: z.array(z.string().trim().min(1)).transform((mediaPaths) => [...new Set(mediaPaths)]),
    tmdbApiKey: z.string().trim().min(1),
    imageHostProviders: z.array(imageHostProviderSchema),
    trackers: z.array(trackerSchema),
    mediainfoPath: z.string().trim().min(1),
    ffmpegPath: z.string().trim().min(1),
    ffprobePath: z.string().trim().min(1),
    movieScreenshotCount: z.number().int().positive(),
    episodePackScreenshotCount: z.number().int().positive(),
    logLevel: z.number().int().min(0).max(5),
})

export default defineEventHandler(async (event) => {
    logger.debug('Settings update request received.')

    const request = await parseValidatedBody(event, settingsRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected settings update with invalid payload.', { issues }),
    })

    for (const mediaPath of request.mediaPaths) {
        const exists = await pathExists(mediaPath)
        if (!exists) {
            logger.warn('Rejected settings update due to non-existent media path.', { mediaPath })

            throw createError({
                statusCode: 400,
                message: 'invalid_media_path',
            })
        }
    }

    await saveSettings(request)
    setLogLevel(request.logLevel)
    logger.info('Settings updated.')

    const savedSettings = await getSettings()
    return toSettingsResponse(savedSettings)
})

async function pathExists(path: string) {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}
