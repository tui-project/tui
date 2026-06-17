import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Path } from '~/composables/useGetPaths'
import StepSelectMedia from '~/components/upload/StepSelectMedia.vue'

const FILE: Path = { label: '/media/movie.mkv', value: '/media/movie.mkv', icon: 'i-lucide-file', folder: false }
const FOLDER: Path = { label: '/media', value: '/media', icon: 'i-lucide-folder', folder: true }
const ROOT_PATHS: Path[] = [FOLDER]

let capturedParent: Ref<string> | null = null
const mockPending = ref(false)
const mockData = ref<Path[] | null>(null)
const mockError = ref<Error | null>(null)
const mockRefresh = vi.fn()

vi.mock('~/composables/useGetPaths', () => ({
    useGetPaths: (parent: Ref<string>) => {
        capturedParent = parent
        return { pending: mockPending, data: mockData, error: mockError, refresh: mockRefresh }
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
    capturedParent = null
    mockPending.value = false
    mockData.value = ROOT_PATHS
    mockError.value = null
})

async function selectFolder() {
    const user = userEvent.setup()
    await renderSuspended(StepSelectMedia)
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '/media' }))
    await screen.findByText('Selected folder')
    return user
}

describe('StepSelectMedia', () => {
    describe('initial parent derivation', () => {
        it.each([
            ['no selection', undefined, ''],
            ['pre-selected file', FILE, '/media'],
            ['pre-selected file at root level (no directory)', { ...FILE, value: 'movie.mkv', label: 'movie.mkv' }, 'movie.mkv'],
            ['pre-selected folder', FOLDER, '/media'],
        ])('%s', async (_, modelValue, expectedParent) => {
            await renderSuspended(StepSelectMedia, { props: { modelValue } })
            expect(capturedParent!.value).toBe(expectedParent)
        })
    })

    describe('search term parent derivation', () => {
        it.each([
            ['/media/a/file.mkv', '/media/a'],
            ['/media/a/sub/', '/media/a/sub'],
        ])('updates parent from "%s"', async (input, expectedParent) => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            await user.type(await screen.findByRole('combobox'), input)
            await waitFor(() => expect(capturedParent!.value).toBe(expectedParent))
        })

        it('does not update parent when input has no directory separator', async () => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            await user.type(await screen.findByRole('combobox'), 'movie')
            expect(capturedParent!.value).toBe('')
        })
    })

    describe('loading state', () => {
        it('opens menu when loading ends while a selection exists', async () => {
            mockPending.value = true
            await renderSuspended(StepSelectMedia, { props: { modelValue: FOLDER } })
            expect(screen.queryAllByRole('option')).toHaveLength(0)

            mockPending.value = false
            await waitFor(() => expect(screen.queryAllByRole('option')).not.toHaveLength(0))
        })

        it('closes menu when loading starts', async () => {
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia, { props: { modelValue: FOLDER } })
            await user.click(await screen.findByRole('combobox'))
            await screen.findByRole('option', { name: '/media' })

            mockPending.value = true
            await waitFor(() => expect(screen.queryByRole('option')).toBeNull())
        })
    })

    describe('folder selection', () => {
        it('sets parent and shows selected folder label', async () => {
            await selectFolder()
            expect(capturedParent!.value).toBe('/media')
            expect(screen.getByText('Selected folder')).toBeTruthy()
        })

        it('does not update parent when search term echoes the selected folder', async () => {
            await selectFolder()
            // UInputMenu automatically emits update:search-term with the selected value after selection;
            // the guard in onSearchTermUpdate prevents that echo from overriding parent
            expect(capturedParent!.value).toBe('/media')
        })
    })

    describe('file selection', () => {
        it('shows selected file label without changing parent', async () => {
            mockData.value = [FILE]
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            await user.click(await screen.findByRole('combobox'))
            await user.click(await screen.findByRole('option', { name: FILE.label }))
            expect(await screen.findByText('Selected file')).toBeTruthy()
            expect(capturedParent!.value).toBe('')
        })
    })

    describe('reset behaviour', () => {
        it('resets parent when an error occurs after navigation', async () => {
            await selectFolder()
            mockError.value = new Error('network')
            await nextTick()
            await waitFor(() => expect(capturedParent!.value).toBe(''))
        })

        it('resets parent and clears selection when the clear button is clicked', async () => {
            await selectFolder()
            const clearButton = document.querySelector('[data-slot="trailing"] [data-slot="base"]')
            if (!clearButton) throw new Error('Clear button not found')
            await userEvent.setup().click(clearButton)
            await waitFor(() => expect(capturedParent!.value).toBe(''))
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
            await user.click(await screen.findByRole('combobox'))
            await user.click(await screen.findByRole('option', { name: '/media' }))
            await user.click(await screen.findByRole('button', { name: 'Next' }))
            expect(emitted()?.next).toHaveLength(1)
        })
    })

    describe('empty data', () => {
        it('renders no options when data is null', async () => {
            mockData.value = null
            const user = userEvent.setup()
            await renderSuspended(StepSelectMedia)
            await user.click(await screen.findByRole('combobox'))
            expect(screen.queryAllByRole('option')).toHaveLength(0)
        })
    })

    describe('error display', () => {
        it('shows error alert when error is set', async () => {
            mockError.value = new Error('network')
            await renderSuspended(StepSelectMedia)
            expect(await screen.findByText('Failed to load paths.')).toBeTruthy()
        })

        it('calls refresh when the retry button is clicked', async () => {
            const user = userEvent.setup()
            mockError.value = new Error('network')
            await renderSuspended(StepSelectMedia)
            await screen.findByText('Failed to load paths.')
            await user.click(await screen.findByRole('button', { name: 'Retry' }))
            expect(mockRefresh).toHaveBeenCalledTimes(1)
        })
    })
})
