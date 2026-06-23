export function useTrackerRequestStatus() {
    function formatStatus(status: Status) {
        return status
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    }

    function getRequestLabel(filepath: string) {
        return filepath.split('/').filter(Boolean).at(-1)
    }

    function getStatusColor(status: Status) {
        switch (status) {
            case STATUS.FAIL:
                return 'error'
            case STATUS.SUCCESS:
                return 'success'
            case STATUS.PARTIAL_SUCCESS:
                return 'warning'
            default:
                return 'neutral'
        }
    }

    function getStatusIcon(status: Status) {
        switch (status) {
            case STATUS.SUCCESS:
                return 'i-heroicons-check-circle'
            case STATUS.FAIL:
                return 'i-heroicons-x-circle'
            case STATUS.PARTIAL_SUCCESS:
                return 'i-heroicons-exclamation-triangle'
            case STATUS.PENDING:
                return 'i-heroicons-clock'
            case STATUS.TORRENT_CREATION:
                return 'i-heroicons-cog-6-tooth'
            case STATUS.UPLOADING:
                return 'i-heroicons-arrow-up-tray'
        }
    }

    function getTrackerUploadStatusColor(uploadStatus?: UploadStatus) {
        switch (uploadStatus) {
            case 'success':
                return 'success'
            case 'failed':
                return 'error'
            default:
                return 'neutral'
        }
    }

    return {
        formatStatus,
        getRequestLabel,
        getStatusColor,
        getStatusIcon,
        getTrackerUploadStatusColor,
    }
}
