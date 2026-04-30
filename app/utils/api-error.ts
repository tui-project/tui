interface FetchLikeError {
    data?: {
        message?: string
    }
}

export function getApiErrorMessage(error: unknown) {
    if (!error || typeof error !== 'object') {
        return ''
    }

    const fetchError = error as FetchLikeError
    if (typeof fetchError.data?.message === 'string' && fetchError.data.message.length > 0) {
        return fetchError.data.message
    }

    return ''
}
