import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve('./package.json'), 'utf-8')) as { version: string }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    runtimeConfig: {
        public: {
            version: pkg.version,
            projectUrl: 'https://github.com/tui-project/tui',
        },
    },
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    typescript: {
        typeCheck: true,
    },
    modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image'],
    icon: {
        provider: 'none',
        clientBundle: {
            scan: true,
            icons: ['heroicons:check-circle', 'heroicons:x-circle', 'heroicons:exclamation-triangle', 'heroicons:clock', 'heroicons:cog-6-tooth', 'heroicons:arrow-up-tray'],
        },
    },
    css: ['~/assets/css/main.css'],
    vite: {
        optimizeDeps: {
            include: ['zod'],
        },
        css: {
            devSourcemap: false,
        },
    },
})
