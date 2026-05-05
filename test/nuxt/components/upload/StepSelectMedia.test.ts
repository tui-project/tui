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

describe('StepSelectMedia', () => {
    it('loads root paths on mount', async () => {
        await renderSuspended(StepSelectMedia)
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: undefined })
        })
    })

    it('shows validation error when next is clicked without selection', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepSelectMedia)

        const nextButton = await screen.findByRole('button', { name: 'Next' })
        await user.click(nextButton)

        expect(await screen.findByText('Select a file or folder before continuing to the next step.')).toBeTruthy()
    })

    it('derives parent from search term and loads matching paths', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepSelectMedia)

        const sourceInput = await screen.findByRole('combobox')
        await user.clear(sourceInput)
        await user.type(sourceInput, '/media/a/file.mkv')

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media/a' } })
        })
    })

    it('derives empty parent when search has no slash', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepSelectMedia)
        vi.clearAllMocks()

        const sourceInput = await screen.findByRole('combobox')
        await user.clear(sourceInput)
        await user.type(sourceInput, 'movie')

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: undefined })
        })
    })

    it('derives parent when search ends with slash', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepSelectMedia)
        vi.clearAllMocks()

        const sourceInput = await screen.findByRole('combobox')
        await user.clear(sourceInput)
        await user.type(sourceInput, '/media/a/sub/')

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media/a/sub' } })
        })
    })

    it('selects a folder from dropdown and loads its children', async () => {
        const user = userEvent.setup()
        fetchMock.mockImplementation(async (_url, options?: { query?: { parent?: string } }) => {
            if (options?.query?.parent === '/media') {
                return [{ path: '/media/movie.mkv', folder: false }]
            }

            return [{ path: '/media', folder: true }]
        })

        await renderSuspended(StepSelectMedia)

        const sourceInput = await screen.findByRole('combobox')
        await user.click(sourceInput)

        const folderOption = await screen.findByRole('option', { name: '/media' })
        await user.click(folderOption)

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media' } })
        })
        expect(await screen.findByText('Selected folder')).toBeTruthy()
    })

    it('retries root paths when loading selected parent fails', async () => {
        const user = userEvent.setup()
        fetchMock.mockImplementation(async (_url, options?: { query?: { parent?: string } }) => {
            if (options?.query?.parent === '/media') {
                throw new Error('network')
            }

            return [{ path: '/media', folder: true }]
        })

        await renderSuspended(StepSelectMedia)

        const sourceInput = await screen.findByRole('combobox')
        await user.click(sourceInput)
        const folderOption = await screen.findByRole('option', { name: '/media' })
        await user.click(folderOption)

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media' } })
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: undefined })
        })
    })

    it('clears selected folder and reloads root paths', async () => {
        const user = userEvent.setup()
        fetchMock.mockImplementation(async (_url, options?: { query?: { parent?: string } }) => {
            if (options?.query?.parent === '/media') {
                return [{ path: '/media/movie.mkv', folder: false }]
            }

            return [{ path: '/media', folder: true }]
        })

        await renderSuspended(StepSelectMedia)

        const sourceInput = await screen.findByRole('combobox')
        await user.click(sourceInput)
        const folderOption = await screen.findByRole('option', { name: '/media' })
        await user.click(folderOption)

        await waitFor(async () => {
            expect(await screen.findByText('Selected folder')).toBeTruthy()
        })

        const clearButton = document.querySelector('[data-slot="trailing"]')
        if (!clearButton) {
            throw new Error('Clear button not found')
        }
        await user.click(clearButton)
        await user.clear(sourceInput)
        await user.tab()

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: undefined })
        })
    })

    it('emits next when selection exists', async () => {
        const user = userEvent.setup()
        const { emitted } = await renderSuspended(StepSelectMedia)

        const sourceInput = await screen.findByRole('combobox')
        await user.click(sourceInput)
        const folderOption = await screen.findByRole('option', { name: '/media' })
        await user.click(folderOption)

        const nextButton = await screen.findByRole('button', { name: 'Next' })
        await user.click(nextButton)

        expect(emitted()?.next).toHaveLength(1)
    })

    it('shows api error alert when loading paths fails', async () => {
        fetchMock.mockRejectedValue(new Error('network'))
        await renderSuspended(StepSelectMedia)

        expect(await screen.findByText('Failed to load paths. Please try again.')).toBeTruthy()
    })

    it('uses initial selected file parent on mount', async () => {
        await renderSuspended(StepSelectMedia, {
            props: {
                modelValue: {
                    label: '/media/movie.mkv',
                    value: '/media/movie.mkv',
                    icon: 'i-lucide-file',
                    folder: false,
                },
            },
        })

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media' } })
        })
    })
})
