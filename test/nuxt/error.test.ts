import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import ErrorPage from '../../app/error.vue'

describe('error.vue', () => {
    it('renders the 404 page not found error', async () => {
        await renderSuspended(ErrorPage)
        expect(screen.getByText('Page not found')).toBeDefined()
    })
})
