export const useApiFetch = createUseFetch(() => ({
    async onResponseError({ response }) {
        if (response.status === 401) {
            await navigateTo('/login')
        }
    },
}))
