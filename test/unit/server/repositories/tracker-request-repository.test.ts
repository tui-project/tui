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
                repack: false,
                proper: false,
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
                { code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false },
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
                { code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false },
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
                repack: false,
                proper: false,
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
                { code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false },
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
                repack: false,
                proper: false,
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
            trackers: [{ code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false }],
            status: 'partial_success',
            failedTrackerCodes: ['FNP'],
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
                repack: false,
                proper: false,
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
            trackers: [{ code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false }],
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
                repack: false,
                proper: false,
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
            trackers: [{ code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false }],
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
                    repack: false,
                    proper: false,
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
                trackers: [{ code: 'FNP', title: 'Title FNP', titleModified: false, anonymous: false }],
                status: 'pending',
            })

            await new Promise((resolve) => setTimeout(resolve, 5))
        }

        const recent = await findAllTrackerUploadRequests(2)

        expect(recent).toHaveLength(2)
        expect(recent.map((request) => request.id)).toEqual(['upload-8', 'upload-7'])
    })
})
