export default defineNuxtPlugin(() => {
    const router = useRouter()

    globalThis.$fetch = $fetch.create({
        onResponseError({ response }) {
            if (response.status === 401) {
                router.push('/login')
            }
        },
    })
})
