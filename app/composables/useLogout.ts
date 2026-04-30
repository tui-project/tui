import { readonly, ref } from 'vue'
import { getApiErrorMessage } from '../utils/api-error'

export function useLogout() {
    const loading = ref(false)
    const errorMessage = ref('')

    async function logout() {
        if (loading.value) {
            return false
        }

        errorMessage.value = ''
        loading.value = true

        try {
            await $fetch('/api/logout', {
                method: 'POST',
            })

            return true
        } catch (fetchError: unknown) {
            errorMessage.value = getApiErrorMessage(fetchError)
            return false
        } finally {
            loading.value = false
        }
    }

    return {
        logout,
        loading: readonly(loading),
        errorMessage: readonly(errorMessage),
    }
}
