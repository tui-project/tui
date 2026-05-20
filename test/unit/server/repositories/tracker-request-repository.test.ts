import { describe, expect, it } from 'vitest'

describe('tracker upload request repository', () => {
    it('creates and finds tracker upload requests', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, findAllTrackerUploadRequests } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: 'Release description',
            trackers: [
                { code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false },
                { code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false },
            ],
            status: 'pending',
        })

        const byId = await findTrackerUploadRequestById('upload-1')
        const all = await findAllTrackerUploadRequests()

        expect(byId).toMatchObject({
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            trackers: [
                { code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false },
                { code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false },
            ],
            status: 'pending',
        })
        expect(all).toHaveLength(1)
        expect(all[0]).toMatchObject({
            id: 'upload-1',
            status: 'pending',
        })
    })

    it('updates partial success status with failed tracker codes', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, updateTrackerUploadRequestStatus } =
            await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-2',
            filepath: '/media/Show.S01E01.2024.1080p.mkv',
            metadata: {
                releaseGroup: 'GROUP',
                mediaType: 'tv',
                title: 'Show',
                originalTitle: 'Show',
                year: 2024,
                season: 1,
                episode: 1,
                language: ['English'],
                originalLanguage: 'English',
                sourceType: 'WEB-DL',
                source: 'Web',
                service: 'NF',
                repack: 0,
                proper: 0,
                hybrid: false,
                resolution: '1080p',
                hdr: [],
                videoCodec: 'H.264',
                audioCodec: 'DD+',
                audioChannels: '5.1',
                tmdbId: 10,
                imdbId: 'tt7654321',
                tvdbId: 20,
            },
            description: '',
            trackers: [
                { code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false },
                { code: 'ATH', title: 'Title ATH', titleModified: false, anonymous: false },
            ],
            status: 'uploading',
        })

        await updateTrackerUploadRequestStatus('upload-2', 'partial_success', ['ATH'])
        const updated = await findTrackerUploadRequestById('upload-2')

        expect(updated).toMatchObject({
            id: 'upload-2',
            status: 'partial_success',
            failedTrackerCodes: ['ATH'],
        })
    })

    it('clears failed tracker codes when leaving partial success', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, updateTrackerUploadRequestStatus } =
            await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-3',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: 'Release description',
            trackers: [{ code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false }],
            status: 'partial_success',
            failedTrackerCodes: ['ULCX'],
        })

        await updateTrackerUploadRequestStatus('upload-3', 'success')
        const updated = await findTrackerUploadRequestById('upload-3')

        expect(updated).toMatchObject({
            id: 'upload-3',
            status: 'success',
        })
        expect(updated?.failedTrackerCodes).toBeUndefined()
    })

    it('stores torrent creation progress updates', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, updateTrackerUploadRequestTorrentCreationProgress } =
            await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-4',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: 'Release description',
            trackers: [{ code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false }],
            status: 'torrent_creation',
        })

        await updateTrackerUploadRequestTorrentCreationProgress('upload-4', 67)
        const updated = await findTrackerUploadRequestById('upload-4')

        expect(updated).toMatchObject({
            id: 'upload-4',
            torrentCreationProgress: 67,
        })
    })

    it('defaults failed tracker codes to an empty list for partial success', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, updateTrackerUploadRequestStatus } =
            await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-5',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: 'Release description',
            trackers: [{ code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false }],
            status: 'uploading',
        })

        await updateTrackerUploadRequestStatus('upload-5', 'partial_success')
        const updated = await findTrackerUploadRequestById('upload-5')

        expect(updated).toMatchObject({
            id: 'upload-5',
            status: 'partial_success',
            failedTrackerCodes: [],
        })
    })

    it('resets a failed request back to pending and clears progress and failed codes', async () => {
        const { saveTrackerUploadRequest, resetTrackerUploadRequest, findTrackerUploadRequestById } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-reset-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: 'desc',
            trackers: [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }],
            status: 'fail',
            torrentCreationProgress: 42,
            failedTrackerCodes: ['ULCX'],
        })

        const reset = await resetTrackerUploadRequest('upload-reset-1')
        const found = await findTrackerUploadRequestById('upload-reset-1')

        expect(reset).toMatchObject({ id: 'upload-reset-1', status: 'pending', torrentCreationProgress: 0 })
        expect(reset?.failedTrackerCodes).toBeUndefined()
        expect(found).toMatchObject({ id: 'upload-reset-1', status: 'pending', torrentCreationProgress: 0 })
        expect(found?.failedTrackerCodes).toBeUndefined()
    })

    it('updates uploadStatus and torrentClientInjected on a specific tracker item', async () => {
        const { saveTrackerUploadRequest, findTrackerUploadRequestById, updateTrackerItem } = await import('../../../../server/repositories/tracker-request-repository')

        await saveTrackerUploadRequest({
            id: 'upload-tracker-item-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: {
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
            },
            description: '',
            trackers: [
                { code: 'ULCX', title: 'Title', titleModified: false, anonymous: false },
                { code: 'ATH', title: 'Title', titleModified: false, anonymous: false },
            ],
            status: 'uploading',
        })

        await updateTrackerItem('upload-tracker-item-1', 'ULCX', { uploadStatus: 'success', torrentClientInjected: true })
        const updated = await findTrackerUploadRequestById('upload-tracker-item-1')

        expect(updated?.trackers.find((t) => t.code === 'ULCX')).toMatchObject({ uploadStatus: 'success', torrentClientInjected: true })
        expect(updated?.trackers.find((t) => t.code === 'ATH')).not.toHaveProperty('uploadStatus')
    })

    it('does nothing when updateTrackerItem is called with a non-existent id', async () => {
        const { updateTrackerItem } = await import('../../../../server/repositories/tracker-request-repository')

        await expect(updateTrackerItem('nonexistent', 'ULCX', { uploadStatus: 'failed' })).resolves.toBeUndefined()
    })

    it('returns null from resetTrackerUploadRequest when the id does not exist', async () => {
        const { resetTrackerUploadRequest } = await import('../../../../server/repositories/tracker-request-repository')

        const result = await resetTrackerUploadRequest('nonexistent-id')

        expect(result).toBeNull()
    })

    it('returns only the most recent tracker upload requests up to the limit when provided', async () => {
        const { saveTrackerUploadRequest, findAllTrackerUploadRequests } = await import('../../../../server/repositories/tracker-request-repository')

        for (const id of ['upload-6', 'upload-7', 'upload-8']) {
            await saveTrackerUploadRequest({
                id,
                filepath: `/media/${id}.mkv`,
                metadata: {
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
                },
                description: 'Release description',
                trackers: [{ code: 'ULCX', title: 'Title ULCX', titleModified: false, anonymous: false }],
                status: 'pending',
            })

            await new Promise((resolve) => setTimeout(resolve, 5))
        }

        const recent = await findAllTrackerUploadRequests(2)

        expect(recent).toHaveLength(2)
        expect(recent.map((request) => request.id)).toEqual(['upload-8', 'upload-7'])
    })
})
