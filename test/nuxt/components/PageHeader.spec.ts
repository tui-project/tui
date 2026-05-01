import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import PageHeader from '../../../app/components/PageHeader.vue'

describe('PageHeader', () => {
    it('renders title and description', async () => {
        await renderSuspended(PageHeader, {
            props: {
                title: 'Settings',
                description: 'Configure settings for the application.',
            },
        })

        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
        expect(screen.getByText('Configure settings for the application.')).toBeTruthy()
    })

    it('renders title without description when not provided', async () => {
        await renderSuspended(PageHeader, {
            props: {
                title: 'Dashboard',
            },
        })

        expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
        expect(screen.queryByText('Configure settings for the application.')).toBeNull()
    })
})
