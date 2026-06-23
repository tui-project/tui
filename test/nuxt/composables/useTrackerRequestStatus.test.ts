import { describe, expect, it } from 'vitest'

describe('useTrackerRequestStatus', () => {
    const { formatStatus, getRequestLabel, getStatusColor, getStatusIcon, getTrackerUploadStatusColor } = useTrackerRequestStatus()

    it('formats statuses into title case', () => {
        expect(formatStatus('partial_success')).toBe('Partial Success')
        expect(formatStatus('pending')).toBe('Pending')
    })

    it('derives a request label from the last path segment', () => {
        expect(getRequestLabel('/media/movies/Movie.2024.mkv')).toBe('Movie.2024.mkv')
        expect(getRequestLabel('/media/show/')).toBe('show')
    })

    it('maps statuses to badge colors', () => {
        expect(getStatusColor('fail')).toBe('error')
        expect(getStatusColor('success')).toBe('success')
        expect(getStatusColor('partial_success')).toBe('warning')
        expect(getStatusColor('pending')).toBe('neutral')
        expect(getStatusColor('uploading')).toBe('neutral')
    })

    it('maps every status to an icon', () => {
        expect(getStatusIcon('success')).toBe('i-heroicons-check-circle')
        expect(getStatusIcon('fail')).toBe('i-heroicons-x-circle')
        expect(getStatusIcon('partial_success')).toBe('i-heroicons-exclamation-triangle')
        expect(getStatusIcon('pending')).toBe('i-heroicons-clock')
        expect(getStatusIcon('torrent_creation')).toBe('i-heroicons-cog-6-tooth')
        expect(getStatusIcon('uploading')).toBe('i-heroicons-arrow-up-tray')
    })

    it('maps tracker upload statuses to colors', () => {
        expect(getTrackerUploadStatusColor('success')).toBe('success')
        expect(getTrackerUploadStatusColor('failed')).toBe('error')
        expect(getTrackerUploadStatusColor(undefined)).toBe('neutral')
    })
})
