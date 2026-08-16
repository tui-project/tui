import { describe, expect, it } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import AboutPage from '../../../app/pages/about.vue'

describe('about page', () => {
    it('renders application details, integrations, tools, and stack', async () => {
        await renderSuspended(AboutPage)

        expect(screen.getByRole('heading', { name: 'About', level: 1 })).toBeDefined()
        expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeDefined()
        expect(screen.getByRole('link', { name: /View on GitHub/ }).getAttribute('href')).toBe('https://github.com/tui-project/tui-v2')

        for (const heading of ['Supported Trackers', 'Image Hosting', 'Torrent Clients', 'Metadata Sources', 'Media Tools', 'Stack']) {
            expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeDefined()
        }

        for (const name of [
            'Aither',
            'Upload.cx',
            'ImgBB',
            'qui',
            'The Movie Database',
            'The TVDB',
            'MediaInfo',
            'FFmpeg',
            'FFprobe',
            'Nuxt 4',
            'Nitro',
            'Nuxt UI v4',
            'NeDB',
            'Zod',
            'create-torrent',
        ]) {
            expect(screen.getByText(name)).toBeDefined()
        }
    })
})
