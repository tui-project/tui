import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve('./package.json'), 'utf-8')) as { version: string }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    runtimeConfig: {
        public: {
            version: pkg.version,
            projectUrl: 'https://github.com/tui-project/tui-v2',
        },
    },
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
        css: {
            devSourcemap: false,
        },
    },
})
