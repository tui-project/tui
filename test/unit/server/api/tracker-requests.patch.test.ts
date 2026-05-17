import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}
const createError = vi.fn((payload: unknown) => payload)
const getRouterParam = vi.fn()
const parseValidatedBody = vi.fn()
const findTrackerUploadRequestById = vi.fn()
const resetTrackerUploadRequest = vi.fn()
const processTrackerUploadRequest = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getRouterParam', getRouterParam)
    getRouterParam.mockReturnValue('upload-1')
    parseValidatedBody.mockReturnValue({ action: 'retry' })
})

function mockEvent() {
    return { waitUntil: (p: Promise<unknown>) => p } as never
}

async function loadHandler() {
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/utils/request-validator', () => ({ parseValidatedBody }))
    vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
        findTrackerUploadRequestById,
        resetTrackerUploadRequest,
    }))
    vi.doMock('../../../../server/services/tracker-upload', () => ({ upload: processTrackerUploadRequest }))

    const { default: handler } = await import('../../../../server/api/tracker/requests/[id].patch')
    return handler
}

function buildExistingRequest(overrides: Record<string, unknown> = {}) {
    return {
        id: 'upload-1',
        filepath: '/media/Movie.2024.1080p.mkv',
        metadata: { mediaType: 'movie', title: 'Movie' },
        description: 'desc',
        trackers: [
            { code: 'ULCX', title: 'Title', titleModified: false, anonymous: false },
            { code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false },
        ],
        status: 'fail',
        torrentCreationProgress: 0,
        ...overrides,
    }
}

describe('PATCH /api/tracker/requests/:id route handler', () => {
    it('returns 404 when the request does not exist', async () => {
        findTrackerUploadRequestById.mockResolvedValue(null)
        const handler = await loadHandler()

        await expect(handler(mockEvent())).rejects.toEqual({ statusCode: 404, message: 'not_found' })
    })

    it('returns 409 when the request is not retryable', async () => {
        findTrackerUploadRequestById.mockResolvedValue(buildExistingRequest({ status: 'success' }))
        const handler = await loadHandler()

        await expect(handler(mockEvent())).rejects.toEqual({ statusCode: 409, message: 'not_retryable' })
    })

    it('rejects an invalid action', async () => {
        parseValidatedBody.mockImplementation((_event: unknown, _schema: unknown, options: { onInvalid?: (issues: unknown[]) => void }) => {
            options.onInvalid?.([{ message: 'Invalid action' }])
            throw { statusCode: 400, message: 'invalid_request' }
        })
        const handler = await loadHandler()

        await expect(handler(mockEvent())).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalled()
    })

    it('resets and retries all trackers for a failed request', async () => {
        const existing = buildExistingRequest({ status: 'fail' })
        findTrackerUploadRequestById.mockResolvedValue(existing)
        resetTrackerUploadRequest.mockResolvedValue({ id: 'upload-1', status: 'pending' })
        const handler = await loadHandler()

        const result = await handler(mockEvent())

        expect(result).toEqual({ id: 'upload-1', status: 'pending' })
        expect(resetTrackerUploadRequest).toHaveBeenCalledWith('upload-1')
        expect(processTrackerUploadRequest).toHaveBeenCalledWith('upload-1', existing.filepath, existing.trackers, existing.metadata, existing.description)
    })

    it('retries only failed trackers for a partial_success request', async () => {
        const existing = buildExistingRequest({ status: 'partial_success', failedTrackerCodes: ['ATH'] })
        findTrackerUploadRequestById.mockResolvedValue(existing)
        resetTrackerUploadRequest.mockResolvedValue({ id: 'upload-1', status: 'pending' })
        const handler = await loadHandler()

        await handler(mockEvent())

        expect(processTrackerUploadRequest).toHaveBeenCalledWith(
            'upload-1',
            existing.filepath,
            [{ code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false }],
            existing.metadata,
            existing.description
        )
    })

    it('retries all trackers for partial_success when failedTrackerCodes is empty', async () => {
        const existing = buildExistingRequest({ status: 'partial_success', failedTrackerCodes: [] })
        findTrackerUploadRequestById.mockResolvedValue(existing)
        resetTrackerUploadRequest.mockResolvedValue({ id: 'upload-1', status: 'pending' })
        const handler = await loadHandler()

        await handler(mockEvent())

        expect(processTrackerUploadRequest).toHaveBeenCalledWith('upload-1', existing.filepath, existing.trackers, existing.metadata, existing.description)
    })

    it('returns 500 when reset fails', async () => {
        findTrackerUploadRequestById.mockResolvedValue(buildExistingRequest({ status: 'fail' }))
        resetTrackerUploadRequest.mockResolvedValue(null)
        const handler = await loadHandler()

        await expect(handler(mockEvent())).rejects.toEqual({ statusCode: 500, message: 'reset_failed' })
    })

    it('logs the retry with previous status', async () => {
        findTrackerUploadRequestById.mockResolvedValue(buildExistingRequest({ status: 'fail' }))
        resetTrackerUploadRequest.mockResolvedValue({ id: 'upload-1', status: 'pending' })
        const handler = await loadHandler()

        await handler(mockEvent())

        expect(logger.info).toHaveBeenCalledWith('Retrying tracker upload request.', { id: 'upload-1', previousStatus: 'fail' })
    })
})
