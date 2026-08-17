export const useApiFetch = createUseFetch(() => {
    const nuxtApp = useNuxtApp()

    return {
        async onResponseError({ response }) {
            if (response.status === 401) {
                await nuxtApp.runWithContext(() => navigateTo('/login'))
            }
        },
    }
})
