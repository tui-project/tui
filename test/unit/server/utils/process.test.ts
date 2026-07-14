import { describe, expect, it, vi } from 'vitest'

const execFile = vi.fn()

vi.mock('node:child_process', () => ({
    execFile,
}))

describe('runCommand', () => {
    it('returns trimmed stdout and stderr', async () => {
        execFile.mockImplementation((_command, _args, _options, callback) => {
            callback(null, ' hello \n', ' warning \n')
        })

        const { runCommand } = await import('../../../../server/utils/process')

        await expect(runCommand('ffmpeg', ['-version'])).resolves.toEqual({
            stdout: 'hello',
            stderr: 'warning',
        })
    })

    it('rejects with the command error unchanged', async () => {
        const error = new Error('boom')
        execFile.mockImplementation((_command, _args, _options, callback) => {
            callback(error, '', 'stderr already represented by the command error')
        })

        const { runCommand } = await import('../../../../server/utils/process')

        await expect(runCommand('ffmpeg', ['-version'])).rejects.toBe(error)
        expect(error.message).toBe('boom')
    })
})
