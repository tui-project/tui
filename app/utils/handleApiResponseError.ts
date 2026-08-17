export async function handleApiResponseError(status: number, nuxtApp: ReturnType<typeof useNuxtApp>) {
    if (status === 401) {
        await nuxtApp.runWithContext(() => navigateTo('/login'))
    }
}
