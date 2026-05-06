import { mountSuspended, renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepDescription from '~/components/upload/StepDescription.vue'
import type { Path } from '~/components/upload/upload.types'

const selectedPath: Path = {
    label: '/media/nas/movie.mkv',
    value: '/media/nas/movie.mkv',
    icon: 'i-lucide-file',
    folder: false,
}

const createScreenshotsMock = vi.fn()
const applyImageLoadingMock = vi.fn()
const bbcodeError = ref<string | undefined>(undefined)
const screenshotLoading = ref(false)
const screenshotError = ref(false)
const screenshotErrorMessage = ref('')

vi.mock('~/composables/useBbcodeRender', () => ({
    useBbcodeRender: () => ({
        toHtml: (content: string) => `<p>${content}</p>`,
        error: bbcodeError,
    }),
}))

vi.mock('~/composables/usePreviewImageLoadingState', () => ({
    usePreviewImageLoadingState: () => ({
        applyImageLoading: applyImageLoadingMock,
    }),
}))

vi.mock('~/composables/useScreenshots', () => ({
    useScreenshots: () => ({
        createScreenshots: createScreenshotsMock,
        loading: screenshotLoading,
        error: screenshotError,
        errorMessage: screenshotErrorMessage,
        clearError: vi.fn(() => {
            screenshotError.value = false
            screenshotErrorMessage.value = ''
        }),
    }),
}))

describe('StepDescription', () => {
    beforeEach(() => {
        createScreenshotsMock.mockReset()
        applyImageLoadingMock.mockReset()
        bbcodeError.value = undefined
        screenshotLoading.value = false
        screenshotError.value = false
        screenshotErrorMessage.value = ''
    })

    it('renders the write state and inserts toolbar tags around a selection', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepDescription)

        const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement
        await user.type(textarea, 'hello world')
        textarea.setSelectionRange(0, 5)

        await user.click(screen.getByRole('button', { name: 'Bold' }))

        await waitFor(() => {
            expect(textarea.value).toBe('[b]hello[/b] world')
        })
    })

    it('renders preview content and applies image loading state', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepDescription, {
            props: {
                modelValue: '[img=500]https://thumb[/img]',
            },
        })

        await user.click(screen.getByRole('button', { name: 'Preview' }))

        expect(screen.getByText(/Uploaded using Tui v beta/)).toBeDefined()
        expect(applyImageLoadingMock).toHaveBeenCalledWith(expect.any(HTMLDivElement), true, true)
    })

    it('switches back to the write tab after previewing', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepDescription, {
            props: {
                modelValue: 'Body copy',
            },
        })

        await user.click(screen.getByRole('button', { name: 'Preview' }))
        expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull()

        await user.click(screen.getByRole('button', { name: 'Write' }))
        expect(screen.getByRole('textbox', { name: 'Description' })).toBeDefined()
    })

    it('shows preview placeholder and bbcode error alert state', async () => {
        const user = userEvent.setup()
        bbcodeError.value = 'parse failed'

        await renderSuspended(StepDescription)
        await user.click(screen.getByRole('button', { name: 'Preview' }))

        expect(screen.getByText(/Preview your BBCode description here before uploading\./)).toBeDefined()
        expect(screen.getByText('parse failed')).toBeDefined()
        expect(applyImageLoadingMock).toHaveBeenCalledWith(expect.any(HTMLDivElement), true, false)
    })

    it('disables screenshot creation until a path is selected and shows screenshot errors', async () => {
        screenshotError.value = true
        screenshotErrorMessage.value = 'Set FFmpeg Path in Settings before generating screenshots.'

        await renderSuspended(StepDescription)

        expect(screen.getByRole('button', { name: 'Add screenshots' }).getAttribute('disabled')).not.toBeNull()
        expect(screen.getByText('Set FFmpeg Path in Settings before generating screenshots.')).toBeDefined()
    })

    it('adds formatted screenshots and hdr disclaimer to the description', async () => {
        const user = userEvent.setup()
        createScreenshotsMock.mockResolvedValue({
            screenshots: [
                { order: 2, url: 'https://two', thumbnailUrl: 'https://thumb-two' },
                { order: 1, url: 'https://one', thumbnailUrl: 'https://thumb-one' },
            ],
        })

        await renderSuspended(StepDescription, {
            props: {
                selectedPath,
                isHdr: true,
                isTv: true,
                modelValue: 'Intro',
            },
        })

        await user.click(screen.getByRole('button', { name: 'Add screenshots' }))

        const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement

        await waitFor(() => {
            expect(createScreenshotsMock).toHaveBeenCalledWith('/media/nas/movie.mkv', true, true)
            expect(textarea.value).toContain('[center]')
            expect(textarea.value).toContain('[url=https://one][img=500]https://thumb-one[/img][/url] [url=https://two][img=500]https://thumb-two[/img][/url]')
            expect(textarea.value).toContain('Screenshots were tone mapped from HDR to SDR for reference.')
        })
    })

    it('adds screenshots without a leading newline when the description is empty', async () => {
        const user = userEvent.setup()
        createScreenshotsMock.mockResolvedValue({
            screenshots: [{ order: 1, url: 'https://one', thumbnailUrl: 'https://thumb-one' }],
        })

        await renderSuspended(StepDescription, {
            props: {
                selectedPath,
            },
        })

        await user.click(screen.getByRole('button', { name: 'Add screenshots' }))

        const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement

        await waitFor(() => {
            expect(createScreenshotsMock).toHaveBeenCalledWith('/media/nas/movie.mkv', false, false)
            expect(textarea.value.startsWith('[center]\n')).toBe(true)
            expect(textarea.value).not.toContain('tone mapped from HDR')
        })
    })

    it('keeps the description unchanged when screenshot generation returns nothing', async () => {
        const user = userEvent.setup()
        createScreenshotsMock.mockResolvedValue(undefined)

        await renderSuspended(StepDescription, {
            props: {
                selectedPath,
                modelValue: 'Existing copy',
            },
        })

        const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement
        await user.click(screen.getByRole('button', { name: 'Add screenshots' }))

        await waitFor(() => {
            expect(createScreenshotsMock).toHaveBeenCalledWith('/media/nas/movie.mkv', false, false)
            expect(textarea.value).toBe('Existing copy')
        })
    })

    it('supports helper fallbacks when the textarea ref is unavailable', async () => {
        const wrapper = await mountSuspended(StepDescription, {
            props: {
                selectedPath,
            },
        })
        const vm = wrapper.vm as unknown as {
            description: string
            editor: HTMLTextAreaElement | undefined
            insertTag: (action: { openTag: string; closeTag: string }) => void
            insertText: (snippet: string) => void
            addScreenshots: () => Promise<void>
        }

        vm.editor = undefined
        vm.description = 'Base'
        vm.insertTag({ openTag: '[i]', closeTag: '[/i]' })
        vm.insertText(' text')

        expect(vm.description).toBe('Base[i][/i] text')

        screenshotLoading.value = true
        await vm.addScreenshots()
        expect(createScreenshotsMock).not.toHaveBeenCalled()

        screenshotLoading.value = false
        createScreenshotsMock.mockResolvedValue(undefined)
        await vm.addScreenshots()
        await nextTick()

        expect(vm.description).toBe('Base[i][/i] text')
    })

    it('returns early from addScreenshots when the service resolves without screenshots', async () => {
        createScreenshotsMock.mockResolvedValue(undefined)
        const wrapper = await mountSuspended(StepDescription, {
            props: {
                selectedPath,
            },
        })
        const vm = wrapper.vm as unknown as {
            description: string
            addScreenshots: () => Promise<void>
        }

        vm.description = 'Keep me'
        await vm.addScreenshots()

        expect(vm.description).toBe('Keep me')
        expect(createScreenshotsMock).toHaveBeenCalledWith('/media/nas/movie.mkv', false, false)
    })
})
