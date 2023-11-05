import { strict as assert } from 'assert';
import { ExecFileOptions, execFile, execFileSync } from 'child_process'
import { join, resolve } from 'path'
import { chmodSync } from 'fs'
import { chmod } from 'fs/promises'

const binDir = {
    darwin: 'oxipng-9.0.0-x86_64-apple-darwin',
    linux: 'oxipng-9.0.0-x86_64-unknown-linux-gnu',
    win32: 'oxipng-9.0.0-x86_64-pc-windows-msvc',
}

const binFile = {
    darwin: 'oxipng',
    linux: 'oxipng',
    win32: 'oxipng.exe',
}

function getProcess(): string {
    assert(process.platform in binDir, `Missing binary for platform ${process.platform}`)

    return resolve(join(__dirname, '..', 'src', 'oxipng', 'bin', binDir[process.platform as keyof typeof binDir], binFile[process.platform as keyof typeof binDir]))
}

let chmodded = false;
export function oxipngSync(args: string[], options: Partial<ExecFileOptions>  = {}) {
    const file = getProcess();

    if (!chmodded) {
        chmodded = true;
        chmodSync(file, 0o777)
    }

    options = Object.assign({ stdio: 'inherit', windowsHide: true }, options)

    return execFileSync(file, args, options)
}

export async function oxipng(args: string[], options: Partial<ExecFileOptions> = {}) {
    const file = getProcess();

    if (!chmodded) {
        chmodded = true;
        await chmod(file, 0o777)
    }

    options = Object.assign({ stdio: 'inherit', windowsHide: true }, options)

    return new Promise<{ code: number | null, signal: NodeJS.Signals | null }>((resolve, reject) => {
        execFile(file, args, options)
            .on('error', err => reject(err))
            .on('exit', (code, signal) => resolve({ code, signal }))
    })
}
