// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    typescript: {
        typeCheck: true,
    },
    modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/test-utils/module', '@nuxt/image', '@nuxt/image'],
    css: ['~/assets/css/main.css'],
    vite: {
        optimizeDeps: {
            include: ['zod'],
        },
    },
})
