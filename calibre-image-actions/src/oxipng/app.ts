import { strict as assert } from 'assert';
import { execFile, execFileSync } from 'child_process'
import { join } from 'path'

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

export function oxipngSync(args: string[], options = {}) {
    assert(process.platform in binDir, `Missing binary for platform ${process.platform}`)

    const file = join(__dirname, 'bin', binDir[process.platform as keyof typeof binDir], binFile[process.platform as keyof typeof binDir])
    options = Object.assign({ stdio: 'inherit', windowsHide: true }, options)

    return execFileSync(file, args, options)
}

export async function oxipng(args: string[], options = {}) {
    assert(process.platform in binDir, `Missing binary for platform ${process.platform}`)

    const file = join(__dirname, 'bin', binDir[process.platform as keyof typeof binDir], binFile[process.platform as keyof typeof binDir])
    options = Object.assign({ stdio: 'inherit', windowsHide: true }, options)

    return new Promise<{ code: number, signal: NodeJS.Signals }>((resolve, reject) => {
        execFile(file, args, options)
            .on('error', err => reject(err))
            .on('exit', (code, signal) => resolve({ code, signal }))
    })
}
