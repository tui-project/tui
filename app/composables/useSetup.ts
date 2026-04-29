import { readonly, ref } from 'vue'

interface SetupResponse {
    id: string
    username: string
}

interface FetchLikeError {
    data?: {
        message?: string
    }
}

function getApiErrorMessage(error: unknown) {
    if (!error || typeof error !== 'object') {
        return ''
    }

    const fetchError = error as FetchLikeError
    if (typeof fetchError.data?.message === 'string' && fetchError.data.message.length > 0) {
        return fetchError.data.message
    }

    return ''
}

export function useSetup() {
    const loading = ref(false)
    const errorMessage = ref('')

    async function initialize(username: string, password: string) {
        if (loading.value) {
            return null
        }

        errorMessage.value = ''
        loading.value = true

        try {
            return await $fetch<SetupResponse>('/api/setup', {
                method: 'POST',
                body: {
                    username,
                    password,
                },
            })
        } catch (fetchError: unknown) {
            errorMessage.value = getApiErrorMessage(fetchError)
            return null
        } finally {
            loading.value = false
        }
    }

    return {
        initialize,
        loading: readonly(loading),
        errorMessage: readonly(errorMessage),
    }
}
