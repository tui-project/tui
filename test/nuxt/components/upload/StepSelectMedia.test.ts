import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepSelectMedia from '~/components/upload/StepSelectMedia.vue'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue([{ path: '/media', folder: true }])
    vi.stubGlobal('$fetch', fetchMock)
})

function mockFolderNavigation() {
    fetchMock.mockImplementation(async (_url, options?: { query?: { parent?: string } }) =>
        options?.query?.parent === '/media' ? [{ path: '/media/movie.mkv', folder: false }] : [{ path: '/media', folder: true }]
    )
}

describe('StepSelectMedia', () => {
    describe('initial fetch', () => {
        it.each([
            { desc: 'no initial selection fetches root', modelValue: undefined, expectedQuery: undefined },
            {
                desc: 'pre-selected file fetches parent directory',
                modelValue: { label: '/media/movie.mkv', value: '/media/movie.mkv', icon: 'i-lucide-file', folder: false },
                expectedQuery: { parent: '/media' },
            },
        ])('$desc', async ({ modelValue, expectedQuery }) => {
            await renderSuspended(StepSelectMedia, { props: modelValue ? { modelValue } : {} })

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: expectedQuery }))
            })
        })
    })

    describe('search term parent derivation', () => {
        it.each([
            ['/media/a/file.mkv', { parent: '/media/a' }],
            ['/media/a/sub/', { parent: '/media/a/sub' }],
        ])('fetches correct parent when search is "%s"', async (input, expectedQuery) => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            vi.clearAllMocks()

            const sourceInput = await screen.findByRole('combobox')
            await user.clear(sourceInput)
            await user.type(sourceInput, input)

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: expectedQuery }))
            })
        })

        it('does not re-fetch when search has no directory separator', async () => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            vi.clearAllMocks()

            const sourceInput = await screen.findByRole('combobox')
            await user.clear(sourceInput)
            await user.type(sourceInput, 'movie')

            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    describe('folder selection', () => {
        it('loads children, shows selected folder, and does not re-fetch on search term echo', async () => {
            const user = userEvent.setup()
            mockFolderNavigation()

            await renderSuspended(StepSelectMedia)
            vi.clearAllMocks()

            const sourceInput = await screen.findByRole('combobox')
            await user.click(sourceInput)
            await user.click(await screen.findByRole('option', { name: '/media' }))

            await waitFor(async () => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: { parent: '/media' } }))
                expect(await screen.findByText('Selected folder')).toBeTruthy()
            })
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })

        it('falls back to root when parent fetch fails', async () => {
            const user = userEvent.setup()
            fetchMock.mockImplementation(async (_url, options?: { query?: { parent?: string } }) => {
                if (options?.query?.parent === '/media') throw new Error('network')
                return [{ path: '/media', folder: true }]
            })

            await renderSuspended(StepSelectMedia)

            const sourceInput = await screen.findByRole('combobox')
            await user.click(sourceInput)
            await user.click(await screen.findByRole('option', { name: '/media' }))

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: { parent: '/media' } }))
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: undefined }))
            })
        })

        it('clears selection and reloads root paths', async () => {
            const user = userEvent.setup()
            mockFolderNavigation()

            await renderSuspended(StepSelectMedia)

            const sourceInput = await screen.findByRole('combobox')
            await user.click(sourceInput)
            await user.click(await screen.findByRole('option', { name: '/media' }))
            await screen.findByText('Selected folder')

            const clearButton = document.querySelector('[data-slot="trailing"]')
            if (!clearButton) throw new Error('Clear button not found')
            await user.click(clearButton)
            await user.clear(sourceInput)
            await user.tab()

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: undefined }))
            })
        })
    })

    describe('navigation', () => {
        it('shows validation error when next is clicked without a selection', async () => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)

            await user.click(await screen.findByRole('button', { name: 'Next' }))

            expect(await screen.findByText('Select a file or folder before continuing to the next step.')).toBeTruthy()
        })

        it('emits next when a selection exists', async () => {
            const user = userEvent.setup()
            const { emitted } = await renderSuspended(StepSelectMedia)

            const sourceInput = await screen.findByRole('combobox')
            await user.click(sourceInput)
            await user.click(await screen.findByRole('option', { name: '/media' }))

            await user.click(await screen.findByRole('button', { name: 'Next' }))

            expect(emitted()?.next).toHaveLength(1)
        })
    })

    describe('error handling', () => {
        it('shows error alert with retry button and re-fetches when retry is clicked', async () => {
            const user = userEvent.setup()
            fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValue([{ path: '/media', folder: true }])
            await renderSuspended(StepSelectMedia)

            expect(await screen.findByText('Failed to load paths.')).toBeTruthy()

            await user.click(await screen.findByRole('button', { name: 'Retry' }))

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledTimes(2)
            })
        })
    })
})
