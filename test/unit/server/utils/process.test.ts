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

    it('rejects when execFile returns an error', async () => {
        execFile.mockImplementation((_command, _args, _options, callback) => {
            callback(new Error('boom'), '', '')
        })

        const { runCommand } = await import('../../../../server/utils/process')

        await expect(runCommand('ffmpeg', ['-version'])).rejects.toThrow('boom')
    })
})
