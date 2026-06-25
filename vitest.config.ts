import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            include: ['server/**/*.{ts,js}', 'app/**/*.{ts,js,vue}'],
            exclude: ['server/**/*.d.ts'],
            reporter: ['text', 'html', 'json'],
        },
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['test/unit/**/*.{test,spec}.ts'],
                    environment: 'node',
                    setupFiles: 'test/unit/setupFile.ts',
                    pool: 'forks',
                },
            },
            {
                test: {
                    name: 'e2e',
                    include: ['test/e2e/**/*.{test,spec}.ts'],
                    environment: 'node',
                    pool: 'forks',
                    maxWorkers: 3,
                    sequence: { groupOrder: 1 },
                },
            },
            await defineVitestProject({
                test: {
                    name: 'nuxt',
                    include: ['test/nuxt/**/*.{test,spec}.ts'],
                    environment: 'nuxt',
                    setupFiles: 'test/nuxt/setupFile.ts',
                },
            }),
        ],
    },
})
