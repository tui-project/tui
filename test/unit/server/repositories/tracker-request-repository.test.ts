import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

function groupIdFor(filepath: string) {
    return createHash('sha256').update(filepath.trim().replace(/\/+$/, '')).digest('hex')
}

const baseMetadata = {
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    title: 'Movie',
    originalTitle: 'Movie',
    year: 2024,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    repack: 0,
    proper: 0,
    hybrid: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
} as unknown as Metadata

function buildRequest(overrides: Partial<Omit<TrackerRequest, 'groupId'>> = {}): Omit<TrackerRequest, 'groupId'> {
    return {
        id: 'upload-1',
        filepath: '/media/Movie.2024.1080p.mkv',
        metadata: baseMetadata,
        description: 'Release description',
        status: 'pending',
        trackers: [{ code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false }],
        ...overrides,
    }
}

describe('groupIdFor (deriveGroupId behaviour)', () => {
    it('is deterministic for the same filepath', () => {
        expect(groupIdFor('/media/Movie.mkv')).toBe(groupIdFor('/media/Movie.mkv'))
    })

    it('ignores surrounding whitespace and trailing slashes', () => {
        expect(groupIdFor('/media/Show/')).toBe(groupIdFor('  /media/Show  '))
    })

    it('produces different ids for different sources', () => {
        expect(groupIdFor('/media/Movie.A.mkv')).not.toBe(groupIdFor('/media/Movie.B.mkv'))
    })
})

describe('tracker upload request repository', () => {
    it('creates and finds tracker upload requests', async () => {
        const { saveTrackerRequest, getTrackerRequest, getTrackerRequests } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(
            buildRequest({
                trackers: [
                    { code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false },
                    { code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false },
                ],
            })
        )

        const byId = await getTrackerRequest('upload-1')
        const { items, total } = await getTrackerRequests(1, 12)

        expect(byId).toMatchObject({
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            groupId: groupIdFor('/media/Movie.2024.1080p.mkv'),
            status: 'pending',
        })
        expect(total).toBe(1)
        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({ id: 'upload-1', status: 'pending' })
    })

    it('updates partial success status with failed tracker codes', async () => {
        const { saveTrackerRequest, getTrackerRequest, updateTrackerRequestStatus } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'upload-2', status: 'uploading' }))

        await updateTrackerRequestStatus('upload-2', 'partial_success', ['ATH'])
        const updated = await getTrackerRequest('upload-2')

        expect(updated).toMatchObject({ id: 'upload-2', status: 'partial_success', failedTrackerCodes: ['ATH'] })
    })

    it('clears failed tracker codes when leaving partial success', async () => {
        const { saveTrackerRequest, getTrackerRequest, updateTrackerRequestStatus } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'upload-3', status: 'partial_success', failedTrackerCodes: ['ULCX'] }))

        await updateTrackerRequestStatus('upload-3', 'success')
        const updated = await getTrackerRequest('upload-3')

        expect(updated).toMatchObject({ id: 'upload-3', status: 'success' })
        expect(updated?.failedTrackerCodes).toBeUndefined()
    })

    it('stores torrent creation progress updates', async () => {
        const { saveTrackerRequest, getTrackerRequest, updateTrackerRequestTorrentCreationProgress } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'upload-4', status: 'torrent_creation' }))

        await updateTrackerRequestTorrentCreationProgress('upload-4', 67)
        const updated = await getTrackerRequest('upload-4')

        expect(updated).toMatchObject({ id: 'upload-4', torrentCreationProgress: 67 })
    })

    it('defaults failed tracker codes to an empty list for partial success', async () => {
        const { saveTrackerRequest, getTrackerRequest, updateTrackerRequestStatus } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'upload-5', status: 'uploading' }))

        await updateTrackerRequestStatus('upload-5', 'partial_success')
        const updated = await getTrackerRequest('upload-5')

        expect(updated).toMatchObject({ id: 'upload-5', status: 'partial_success', failedTrackerCodes: [] })
    })

    it('resets a failed request back to pending and clears progress and failed codes', async () => {
        const { saveTrackerRequest, resetTrackerRequest, getTrackerRequest } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'upload-reset-1', status: 'fail', torrentCreationProgress: 42, failedTrackerCodes: ['ULCX'] }))

        const reset = await resetTrackerRequest('upload-reset-1')
        const found = await getTrackerRequest('upload-reset-1')

        expect(reset).toMatchObject({ id: 'upload-reset-1', status: 'pending', torrentCreationProgress: 0 })
        expect(reset?.failedTrackerCodes).toBeUndefined()
        expect(found).toMatchObject({ id: 'upload-reset-1', status: 'pending', torrentCreationProgress: 0 })
        expect(found?.failedTrackerCodes).toBeUndefined()
    })

    it('updates uploadStatus and torrentClientInjected on a specific tracker item', async () => {
        const { saveTrackerRequest, getTrackerRequest, updateTrackerItem } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(
            buildRequest({
                id: 'upload-tracker-item-1',
                status: 'uploading',
                trackers: [
                    { code: 'ULCX', title: 'Title', titleModified: false, anonymous: false },
                    { code: 'ATH', title: 'Title', titleModified: false, anonymous: false },
                ],
            })
        )

        await updateTrackerItem('upload-tracker-item-1', 'ULCX', { uploadStatus: 'success', torrentClientInjected: true })
        const updated = await getTrackerRequest('upload-tracker-item-1')

        expect(updated?.trackers.find((t) => t.code === 'ULCX')).toMatchObject({ uploadStatus: 'success', torrentClientInjected: true })
        expect(updated?.trackers.find((t) => t.code === 'ATH')).not.toHaveProperty('uploadStatus')
    })

    it('does nothing when updateTrackerItem is called with a non-existent id', async () => {
        const { updateTrackerItem } = await import('../../../../server/repositories/tracker-request-repository')

        await expect(updateTrackerItem('nonexistent', 'ULCX', { uploadStatus: 'failed' })).resolves.toBeUndefined()
    })

    it('returns null from resetTrackerRequest when the id does not exist', async () => {
        const { resetTrackerRequest } = await import('../../../../server/repositories/tracker-request-repository')

        const result = await resetTrackerRequest('nonexistent-id')

        expect(result).toBeNull()
    })

    it('returns only the most recent tracker upload requests for the given page and size', async () => {
        const { saveTrackerRequest, getTrackerRequests } = await import('../../../../server/repositories/tracker-request-repository')

        for (const id of ['upload-6', 'upload-7', 'upload-8']) {
            await saveTrackerRequest(buildRequest({ id, filepath: `/media/${id}.mkv` }))
            await new Promise((resolve) => setTimeout(resolve, 5))
        }

        const { items, total } = await getTrackerRequests(1, 2)

        expect(total).toBe(3)
        expect(items).toHaveLength(2)
        expect(items.map((request) => request.id)).toEqual(['upload-8', 'upload-7'])

        const secondPage = await getTrackerRequests(2, 2)
        expect(secondPage.items.map((request) => request.id)).toEqual(['upload-6'])
    })

    it('annotates items with their group count when withGroupCount is true', async () => {
        const { saveTrackerRequest, getTrackerRequests } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'a-1', filepath: '/media/MovieA.mkv' }))
        await saveTrackerRequest(buildRequest({ id: 'a-2', filepath: '/media/MovieA.mkv' }))
        await saveTrackerRequest(buildRequest({ id: 'b-1', filepath: '/media/MovieB.mkv' }))

        const { items } = await getTrackerRequests(1, 10, true)

        expect(items.find((i) => i.id === 'a-1')?.groupCount).toBe(2)
        expect(items.find((i) => i.id === 'a-2')?.groupCount).toBe(2)
        expect(items.find((i) => i.id === 'b-1')?.groupCount).toBe(1)
    })

    it('does not annotate items with group count when withGroupCount is false', async () => {
        const { saveTrackerRequest, getTrackerRequests } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'c-1', filepath: '/media/MovieC.mkv' }))

        const { items } = await getTrackerRequests(1, 10, false)

        expect(items.find((i) => i.id === 'c-1')?.groupCount).toBeUndefined()
    })

    it('returns all requests for a group, newest first', async () => {
        const { saveTrackerRequest, getTrackerRequestsByGroup } = await import('../../../../server/repositories/tracker-request-repository')

        for (const id of ['g-1', 'g-2', 'g-3']) {
            await saveTrackerRequest(buildRequest({ id, filepath: id === 'g-3' ? '/media/Other.mkv' : '/media/Shared.mkv' }))
            await new Promise((resolve) => setTimeout(resolve, 5))
        }

        const group = await getTrackerRequestsByGroup(groupIdFor('/media/Shared.mkv'))

        expect(group.map((request) => request.id)).toEqual(['g-2', 'g-1'])
    })

    it('backfills groupId on records that are missing it', async () => {
        const { saveTrackerRequest, getTrackerRequest, backfillTrackerRequestGroupIds } = await import('../../../../server/repositories/tracker-request-repository')
        const { trackerUploadRequestCollection } = await import('../../../../server/utils/db')

        // Save one already-tagged record and insert one missing groupId directly.
        await saveTrackerRequest(buildRequest({ id: 'tagged' }))
        const untagged = buildRequest({ id: 'untagged', filepath: '/media/Untagged.mkv' })
        await trackerUploadRequestCollection.insertAsync(untagged as TrackerRequest)

        await backfillTrackerRequestGroupIds()

        expect((await getTrackerRequest('untagged'))?.groupId).toBe(groupIdFor('/media/Untagged.mkv'))
        expect((await getTrackerRequest('tagged'))?.groupId).toBe(groupIdFor('/media/Movie.2024.1080p.mkv'))
    })

    it('does nothing when no records are missing a groupId', async () => {
        const { saveTrackerRequest, getTrackerRequest, backfillTrackerRequestGroupIds } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerRequest(buildRequest({ id: 'tagged-only' }))

        await backfillTrackerRequestGroupIds()

        expect((await getTrackerRequest('tagged-only'))?.groupId).toBe(groupIdFor('/media/Movie.2024.1080p.mkv'))
    })
})
