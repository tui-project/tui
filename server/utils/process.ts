import { execFile } from 'node:child_process'

export interface CommandResult {
    stdout: string
    stderr: string
}

export function runCommand(command: string, args: string[]) {
    return new Promise<CommandResult>((resolve, reject) => {
        execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                reject(error)
                return
            }

            resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            })
        })
    })
}
