import { readonly, ref } from 'vue'
import { getApiErrorMessage } from '../utils/api-error'

interface LoginResponse {
    sessionId: string
    userId: string
    expiresAt: string
}

export function useLogin() {
    const loading = ref(false)
    const errorMessage = ref('')

    async function login(username: string, password: string) {
        if (loading.value) {
            return null
        }

        errorMessage.value = ''
        loading.value = true

        try {
            return await $fetch<LoginResponse>('/api/login', {
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
        login,
        loading: readonly(loading),
        errorMessage: readonly(errorMessage),
    }
}
