import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import StepNavigationButtons from '../../../app/components/upload/StepNavigationButtons.vue'

describe('StepNavigationButtons', () => {
    it('renders defaults and emits back/next clicks', async () => {
        const user = userEvent.setup()
        const { emitted } = await renderSuspended(StepNavigationButtons)

        const backButton = await screen.findByRole('button', { name: 'Back' })
        const nextButton = await screen.findByRole('button', { name: 'Next' })

        await user.click(backButton)
        await user.click(nextButton)

        expect(emitted()?.back).toHaveLength(1)
        expect(emitted()?.next).toHaveLength(1)
    })

    it('applies custom labels and disabled state', async () => {
        await renderSuspended(StepNavigationButtons, {
            props: {
                back: { label: 'Previous', disabled: true },
                next: { label: 'Continue', disabled: true },
            },
        })

        const backButton = await screen.findByRole('button', { name: 'Previous' })
        const nextButton = await screen.findByRole('button', { name: 'Continue' })

        expect(backButton.getAttribute('disabled')).not.toBeNull()
        expect(nextButton.getAttribute('disabled')).not.toBeNull()
    })
})
