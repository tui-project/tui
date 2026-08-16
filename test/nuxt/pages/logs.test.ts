import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import LogsPage from '../../../app/pages/logs.vue'

const logs = ref<LogEntry[]>([])
const connected = ref(true)
const streamError = ref(false)
const clear = vi.fn()

mockNuxtImport('useStreamLogs', () => () => ({
    logs,
    connected,
    error: streamError,
    clear,
}))

describe('logs page', () => {
    beforeEach(() => {
        clear.mockReset()
        connected.value = true
        streamError.value = false
        logs.value = [
            { id: 1, time: '2026-08-15T01:00:00.000Z', type: 'info', scope: 'database', msg: 'Database ready', context: { count: 2 } },
            { id: 2, time: '2026-08-15T01:00:01.000Z', type: 'error', scope: 'tracker', msg: 'Upload failed' },
        ]
    })

    it('renders live structured log entries', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500)
        await renderSuspended(LogsPage)

        expect(screen.getByRole('heading', { name: 'Live logs' })).toBeDefined()
        expect(screen.getByText('Watch and filter the latest 1,000 application log entries by text, type, or scope.')).toBeDefined()
        expect(screen.getByText('Live')).toBeDefined()
        expect(screen.getByText('Database ready')).toBeDefined()
        expect(screen.getByText('Upload failed')).toBeDefined()
        expect(screen.getByText(/"count": 2/)).toBeDefined()
        expect(screen.getByText('2 of 2 entries')).toBeDefined()
        expect(document.querySelector<HTMLElement>('[data-log-viewport]')?.scrollTop).toBe(500)
        scrollHeight.mockRestore()
    })

    it('filters logs by search text and clears the viewer', async () => {
        const user = userEvent.setup({ delay: null })
        await renderSuspended(LogsPage)
        const searchInput = screen.getByPlaceholderText('Text or key=value, e.g. trackerCode=ATH')

        expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
        await user.type(searchInput, 'database')

        expect(screen.getByText('Database ready')).toBeDefined()
        expect(screen.queryByText('Upload failed')).toBeNull()
        expect(screen.getByText('1 of 2 entries')).toBeDefined()

        await user.click(screen.getByRole('button', { name: 'Clear search' }))
        expect((searchInput as HTMLInputElement).value).toBe('')
        expect(screen.getByText('Upload failed')).toBeDefined()

        await user.click(screen.getByRole('button', { name: 'Clear' }))
        expect(clear).toHaveBeenCalledOnce()
    })

    it('filters JSON context using key-value pairs and nested paths', async () => {
        logs.value = [
            { id: 1, time: '2026-08-15T01:00:00.000Z', type: 'info', msg: 'First upload', context: { trackerCode: 'ATH', request: { id: 'req-1' } } },
            { id: 2, time: '2026-08-15T01:00:01.000Z', type: 'info', msg: 'Second upload', context: [{ trackerCode: 'ULCX' }, { request: { id: 'req-2' } }] },
        ]
        const user = userEvent.setup({ delay: null })
        await renderSuspended(LogsPage)
        const searchInput = screen.getByPlaceholderText('Text or key=value, e.g. trackerCode=ATH')

        await user.type(searchInput, 'trackerCode=ulcx request.id=req-2')

        expect(screen.queryByText('First upload')).toBeNull()
        expect(screen.getByText('Second upload')).toBeDefined()

        await user.clear(searchInput)
        await user.type(searchInput, 'missing=value')
        expect(screen.getByText('No matching log entries.')).toBeDefined()
    })

    it('filters by type and scope and renders every log color', async () => {
        logs.value = [
            { id: 1, time: '2026-08-15T01:00:00.000Z', type: 'fatal', scope: 'api', msg: 'Fatal entry' },
            { id: 2, time: '2026-08-15T01:00:01.000Z', type: 'warn', scope: 'api', msg: 'Warning entry' },
            { id: 3, time: '2026-08-15T01:00:02.000Z', type: 'info', scope: 'database', msg: 'Info entry' },
            { id: 4, time: '2026-08-15T01:00:03.000Z', type: 'debug', scope: 'database', msg: 'Debug entry' },
            { id: 5, time: '2026-08-15T01:00:04.000Z', type: 'trace', scope: 'worker', msg: 'Trace entry' },
        ]
        const user = userEvent.setup({ delay: null })
        await renderSuspended(LogsPage)

        await user.click(screen.getByRole('combobox', { name: 'Type' }))
        await user.click(await screen.findByRole('option', { name: 'Warn' }))
        expect(screen.getByText('Warning entry')).toBeDefined()
        expect(screen.queryByText('Fatal entry')).toBeNull()

        await user.click(screen.getByRole('combobox', { name: 'Type' }))
        await user.click(await screen.findByRole('option', { name: 'All types' }))
        await user.click(screen.getByRole('combobox', { name: 'Scope' }))
        await user.click(await screen.findByRole('option', { name: 'database' }))
        expect(screen.getByText('Info entry')).toBeDefined()
        expect(screen.getByText('Debug entry')).toBeDefined()
        expect(screen.queryByText('Warning entry')).toBeNull()
    })

    it('shows connecting and reconnecting stream states', async () => {
        connected.value = false
        await renderSuspended(LogsPage)

        expect(screen.getByText('Connecting…')).toBeDefined()
        streamError.value = true
        await nextTick()
        expect(screen.getByText('Reconnecting…')).toBeDefined()
    })

    it('expands and collapses large JSON contexts', async () => {
        logs.value = [
            {
                id: 1,
                time: '2026-08-15T01:00:00.000Z',
                type: 'info',
                msg: 'Large payload',
                context: { payload: 'x'.repeat(600) },
            },
        ]
        const user = userEvent.setup({ delay: null })
        await renderSuspended(LogsPage)

        expect(screen.getByText(/…$/)).toBeDefined()
        await user.click(screen.getByRole('button', { name: 'Show more' }))
        expect(screen.getByText(new RegExp(`"payload": "${'x'.repeat(600)}"`))).toBeDefined()

        await user.click(screen.getByRole('button', { name: 'Show less' }))
        expect(screen.getByText(/…$/)).toBeDefined()
    })

    it('shows and copies the complete structured log entry', async () => {
        const user = userEvent.setup({ delay: null })
        const writeText = vi.spyOn(navigator.clipboard, 'writeText')
        await renderSuspended(LogsPage)

        await user.click(screen.getByRole('button', { name: 'View log details: Database ready' }))

        expect(screen.getByRole('heading', { name: 'Log entry details' })).toBeDefined()
        expect(screen.getByText(/"scope": "database"/)).toBeDefined()
        await user.click(screen.getByRole('button', { name: 'Copy JSON' }))
        expect(writeText).toHaveBeenCalledWith(JSON.stringify(logs.value[0], null, 2))
        expect(screen.getByRole('button', { name: 'Copied' })).toBeDefined()

        writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'))
        await user.click(screen.getByRole('button', { name: 'Copied' }))
        expect(screen.getByRole('button', { name: 'Copy failed' })).toBeDefined()

        await user.click(screen.getByRole('button', { name: 'Close details' }))
        expect(screen.queryByRole('heading', { name: 'Log entry details' })).toBeNull()

        const entry = screen.getByRole('button', { name: 'View log details: Database ready' })
        entry.focus()
        await user.keyboard('{Enter}')
        expect(screen.getByRole('heading', { name: 'Log entry details' })).toBeDefined()
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('heading', { name: 'Log entry details' })).toBeNull()

        entry.focus()
        await user.keyboard(' ')
        expect(screen.getByRole('heading', { name: 'Log entry details' })).toBeDefined()
    })

    it('shows an empty result state', async () => {
        logs.value = []
        await renderSuspended(LogsPage)

        expect(screen.getByText('No matching log entries.')).toBeDefined()
    })
})
