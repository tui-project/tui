export default defineNuxtPlugin((nuxtApp) => {
    const api = $fetch.create({
        async onResponseError({ response }) {
            await handleApiResponseError(response.status, nuxtApp)
        },
    })

    return {
        provide: { api },
    }
})
