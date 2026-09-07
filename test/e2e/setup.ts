import { resolve } from 'node:path'
import { setup as setupNuxt, type TestOptions } from '@nuxt/test-utils/e2e'

export const e2eOutputDir = resolve('.nuxt/e2e-output')

export async function setup(options: Partial<TestOptions> = {}) {
    await setupNuxt({
        ...options,
        build: false,
        nuxtConfig: {
            ...options.nuxtConfig,
            nitro: {
                ...options.nuxtConfig?.nitro,
                output: {
                    ...options.nuxtConfig?.nitro?.output,
                    dir: e2eOutputDir,
                },
            },
        },
    })
}
