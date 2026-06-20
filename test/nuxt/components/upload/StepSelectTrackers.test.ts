import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepSelectTrackers from '~/components/upload/StepSelectTrackers.vue'
import type { AppSettings, TrackerSettings } from '~/composables/useGetSettings'

function buildTrackerSettings(trackers: Partial<TrackerSettings>[]): AppSettings {
    return {
        mediaPaths: [],
        tmdbApiKey: '',
        imageHostProviders: [],
        trackers: trackers.map((t) => ({ selected: false, code: '', name: '', ...t })),
        torrentClients: [],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        logLevel: 3,
    }
}

const settingsData = ref<AppSettings | null>(null)
const loading = ref(false)
const loadError = ref<Error | null>(null)

vi.mock('~/composables/useGetSettings', () => ({
    useGetSettings: () => ({
        pending: loading,
        data: settingsData,
        error: loadError,
        refresh: vi.fn(),
    }),
}))

mockNuxtImport('navigateTo', () => vi.fn())

describe('StepSelectTrackers', () => {
    beforeEach(() => {
        settingsData.value = null
        loading.value = false
        loadError.value = null
    })

    it('loads only selected trackers from settings and toggles upload targets', async () => {
        const user = userEvent.setup()
        settingsData.value = buildTrackerSettings([
            { selected: true, code: 'ULCX', name: 'Upload.cx' },
            { selected: false, code: 'ATH', name: 'Aither' },
            { selected: true, code: 'BHD', name: 'BeyondHD' },
        ])

        const { emitted } = await renderSuspended(StepSelectTrackers, {
            props: { modelValue: [] },
        })

        expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy()
        expect(screen.getByRole('checkbox', { name: 'BeyondHD (BHD)' })).toBeTruthy()
        expect(screen.queryByRole('checkbox', { name: 'Aither (ATH)' })).toBeNull()
        expect(screen.getByText('Selected: 0')).toBeTruthy()

        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))

        await waitFor(() => {
            expect(screen.getByText('Selected: 1')).toBeTruthy()
        })

        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))

        await waitFor(() => {
            expect(screen.getByText('Selected: 0')).toBeTruthy()
        })

        const updateEvents = emitted()['update:modelValue'] as string[][] | undefined
        expect(updateEvents?.at(-2)?.[0]).toEqual(['ULCX'])
        expect(updateEvents?.at(-1)?.[0]).toEqual([])
    })

    it('shows an empty state when no trackers are enabled in settings', async () => {
        settingsData.value = buildTrackerSettings([{ selected: false, code: 'ULCX', name: 'Upload.cx' }])

        await renderSuspended(StepSelectTrackers, {
            props: { modelValue: [] },
        })

        expect(await screen.findByText('Select at least one tracker in Settings to continue.')).toBeTruthy()
    })

    it('shows an error alert when trackers fail to load', async () => {
        loadError.value = new Error('network')

        await renderSuspended(StepSelectTrackers, {
            props: { modelValue: [] },
        })

        expect(await screen.findByText('Failed to load trackers from settings. Please try again.')).toBeTruthy()
    })

    it('shows loading skeletons while settings are being fetched', async () => {
        loading.value = true

        await renderSuspended(StepSelectTrackers, {
            props: { modelValue: [] },
        })

        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    it('Next button is disabled until at least one tracker is selected', async () => {
        const user = userEvent.setup()
        settingsData.value = buildTrackerSettings([{ selected: true, code: 'ULCX', name: 'Upload.cx' }])

        const { emitted } = await renderSuspended(StepSelectTrackers, {
            props: { modelValue: [] },
        })

        const nextButton = await screen.findByRole('button', { name: 'Next' })
        expect(nextButton).toHaveProperty('disabled', true)

        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await waitFor(() => expect(nextButton).toHaveProperty('disabled', false))

        await user.click(nextButton)
        expect(emitted()['next']).toBeTruthy()
    })
})
