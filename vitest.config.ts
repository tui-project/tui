import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            include: ['server/**/*.{ts,js}'],
            exclude: ['server/**/*.d.ts'],
            reporter: ['text', 'html'],
        },
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['test/unit/**/*.{test,spec}.ts'],
                    environment: 'node',
                    setupFiles: 'test/unit/setupFile.ts',
                },
            },
            {
                test: {
                    name: 'e2e',
                    include: ['test/e2e/**/*.{test,spec}.ts'],
                    environment: 'node',
                    fileParallelism: false,
                    maxWorkers: 1,
                },
            },
            await defineVitestProject({
                test: {
                    name: 'nuxt',
                    include: ['test/nuxt/*.{test,spec}.ts'],
                    environment: 'nuxt',
                },
            }),
        ],
    },
})
