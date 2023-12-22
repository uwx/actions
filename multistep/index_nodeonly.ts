// @ts-check

import { getBooleanInput, getInput, setOutput, group, setFailed, endGroup, startGroup, notice, info, error, exportVariable } from '@actions/core';
import { rmRF, which, mv } from '@actions/io';
import { exec as _exec, exec } from '@actions/exec';
import { create as createArtifact } from '@actions/artifact';
import { create as createGlob } from '@actions/glob';
import { join, resolve } from 'path/win32';
import { existsSync } from 'fs';

import { unlink, writeFile } from 'fs/promises';
import { ExecPublicState, ToolRunner, argStringToArray } from './execx.ts';

import { generateCtrlBreakAsync } from 'generate-ctrl-c-event';
import { inspect } from 'util';

process.on('SIGINT', function () {
});

//

const run = getInput('run', { required: true });
const beforeRun = getInput('before', { required: false });
const afterRun = getInput('after', { required: false });

// paths
const cwd = getInput('cwd', { required: false}) || resolve('.');
const tarballRoot = resolve(cwd, getInput('tarball-root', { required: true }))
const tarballGlob = resolve(cwd, getInput('tarball-pattern', { required: false }) || tarballRoot);

// archiving
const tarballArtifactName = getInput('tarball-artifact-name', { required: false });
const tarballFileName = getInput('tarball-file-name', { required: false });
const loadTarballArtifactIfExists = getBooleanInput('load-tarball-artifact-if-exists', { required: false });
const saveTarballArtifact = getBooleanInput('save-tarball-artifact', { required: false });

// execution
const shell = getInput('shell', { required: false }) as Shell;
const input = getInput('input', { required: false });
const inputEncoding = getInput('input-encoding', { required: false }) || 'utf-8';
const failOnStdErr = getBooleanInput('fail-on-stderr', { required: false });
const ignoreExitCodes = getInput("ignore-exit-codes", { required: false }).split(',').map(parseInt);

// timeout
const timeoutKey = getInput('key', { required: false });
const timeout = Number(getInput('timeout', { required: false }));

//
const artifactClient = createArtifact();

function withLogGroup(message: string): Disposable {
    startGroup(message);
    return {
        [Symbol.dispose]() {
            endGroup();
        }
    };
}

{
    using _ = withLogGroup("Downloading and extracting artifact");

    let ok = true;

    if (loadTarballArtifactIfExists) {
        ok = false;
        try {
            artifactClient.downloadArtifact(tarballArtifactName, tarballRoot);
            ok = true;
        } catch (err) {
            if (err && typeof err === 'object' && 'message' in err && (err.message == 'Unable to find any artifacts for the associated workflow' || err.message == `Unable to find an artifact with the name: ${tarballArtifactName}`)) {
                ok = false;
            } else {
                throw err;
            }
        }

        if (ok && existsSync(tarballRoot)) {
            await exec('7z', ['x', '-y', resolve(tarballRoot, tarballFileName)], { cwd: tarballRoot });
            await unlink(resolve(tarballRoot, tarballFileName));
        }
    }
}

let endTime: number | null = null;

function isExecutionTimedOut() {
    return endTime != null && endTime < Date.now();
}

function calcTimeout() {
    return endTime != null ? Math.max(endTime - Date.now(), 1) : 1;
}

let item: string | undefined;
if ((item = process.env[`STAGE_END_${timeoutKey}`])) {
    endTime = Number(item)
    notice(`This build stage will time out at ${endTime}`);
}

const enum ExecutionResult {
    Success = "success",
    Timeout = "timeout",
    Failure = "failure",
    Skipped = "skipped",
}

if (beforeRun) {
    if (isExecutionTimedOut()) {
        setOutput('results-per-command', '[]');
        setOutput('before-run-outcome', ExecutionResult.Timeout);
        setOutput('outcome', ExecutionResult.Timeout);
        setOutput('after-run-outcome', (afterRun ? ExecutionResult.Timeout : ExecutionResult.Skipped));
        notice("Timed out before before-hook execution");
        process.exit(0);
    }

    const result = await runWithTimeout(beforeRun, {
        cwd: cwd,
        failOnStdErr: failOnStdErr,
        shell,
        ignoreExitCodes: ignoreExitCodes
    });

    setOutput('before-run-outcome', result.outcome)
    if (result.outcome == ExecutionResult.Failure) {
        setOutput('outcome', ExecutionResult.Failure);
        error("Before-run hook failed: $failCase");
        process.exit(1);
    }
} else {
    setOutput('before-run-outcome', ExecutionResult.Skipped);
}

if (endTime == null) {
    endTime = Date.now() + timeout;
    exportVariable(`STAGE_END_${timeoutKey}`, endTime);
    info(`This build stage will time out at ${endTime}`)
}

if (isExecutionTimedOut()) {
    await saveBuildArtifacts();

    setOutput('results-per-command', '[]');
    setOutput('outcome', ExecutionResult.Timeout);
    setOutput('after-run-outcome', afterRun != null ? ExecutionResult.Timeout : ExecutionResult.Skipped);
    notice("Timed out before main command execution")
    process.exit(0);
}

{
    let result = await runWithTimeout(run, {cwd: cwd, failOnStdErr: failOnStdErr, shell: shell, ignoreExitCodes: ignoreExitCodes, timeout: calcTimeout()});

    switch (result.outcome) {
        case ExecutionResult.Failure: {
            setOutput('outcome', ExecutionResult.Failure);
            setOutput('after-run-outcome', ExecutionResult.Skipped);
            error(result.failCase ?? '');
        }
        case ExecutionResult.Timeout: {
            setOutput('outcome', ExecutionResult.Timeout);
            setOutput('after-run-outcome', ExecutionResult.Skipped);
            await saveBuildArtifacts();
            notice("Execution has timed out");
        }
        case ExecutionResult.Success: {
            setOutput('outcome', ExecutionResult.Success);

            if (afterRun != null) {
                result = await runWithTimeout(afterRun, { cwd: cwd, failOnStdErr: failOnStdErr, shell: shell, ignoreExitCodes: ignoreExitCodes});

                setOutput('after-run-outcome', result.outcome);
                if (result.outcome == ExecutionResult.Failure) {
                    setOutput('outcome', ExecutionResult.Failure);
                    error(`After-run hook failed: ${result.failCase}`);
                }
                else {
                    setOutput('outcome', ExecutionResult.Success);
                }
            }
            else {
                setOutput('after-run-outcome', ExecutionResult.Skipped);
                setOutput('outcome', ExecutionResult.Success);
            }
        }
    }
}

async function repeatOnFail(label: string, action: () => unknown, maxRetries = 5) {
    for (let i = 0; i < maxRetries; ++i) {
        try {
            await action();
            break;
        } catch (e) {
            console.error(`${label} failed: ${e}. Attempt ${i + 1} of ${maxRetries}`);
            // Wait 10 seconds between the attempts
            await delay(10000);
        }
    }
}

type Shell = 'none' | 'pwsh' | 'cmd' | 'python' | 'node';

const delayedSymbol = Symbol('delayed');

function delay(ms: number): Promise<typeof delayedSymbol> {
    return new Promise(r => setTimeout(() => r(delayedSymbol), ms));
}

function delayCancelable(ms: number): { promise: Promise<typeof delayedSymbol>; cancel: () => void; } {
    /** @type {(result: typeof delayedSymbol) => void} */
    let r: (result: typeof delayedSymbol) => void;
    const promise = new Promise<typeof delayedSymbol>(r1 => r = r1);
    const timeout = setTimeout(() => r(delayedSymbol), ms);
    return { promise, cancel: () => clearTimeout(timeout) };
}

async function awaitWithTimeout<T>(promise: Promise<T>, ms: number): Promise<{ timedOut: boolean; result: T | Promise<T>; }> {
    const { promise: delayPromise, cancel: cancelDelay } = delayCancelable(ms);
    const result = await Promise.race([promise, delayPromise]);
    if (result !== delayedSymbol) { // did not timeout
        cancelDelay();
        return { timedOut: false, result };
    } else { // did timeout
        return { timedOut: true, result: promise };
    }
}

async function saveBuildArtifacts() {
    await delay(5000);

    if (saveTarballArtifact) {
        console.time('glob');

        const globbed = await (await createGlob(tarballGlob, { implicitDescendants: true })).glob();

        console.timeEnd('glob');
        console.log(`Globbed ${globbed.length} files`);

        {
            using _ = withLogGroup("Tarballing build files")
            // Write source directories to manifest.txt to avoid command length limits
            let manifestFilename = "manifest.txt"
            await writeFile(resolve(tarballRoot, manifestFilename), globbed.join('\n'));

            let tarFileName = resolve(tarballRoot, tarballFileName);
            await exec('7z', ['a', tarFileName, '-m0=zstd', '-mx2', `@${manifestFilename}`, `-x!${tarFileName}`, `-x!${manifestFilename}`], { cwd: tarballRoot });

            await unlink(resolve(tarballRoot, manifestFilename));
        }

        {
            using _ = withLogGroup("Upload artifact")

            repeatOnFail('Upload artifact', async () => {
                await artifactClient.uploadArtifact(tarballArtifactName, [resolve(tarballRoot, tarballFileName)], tarballRoot, {
                    retentionDays: 3
                });
            }, 5);
        }
    }
}

async function wrapInShell(command: string, shell: Shell) {
    switch (shell) {
        case 'pwsh': {
            try {
                const pwshPath = await which('pwsh');

                console.log(`Using pwsh at path: ${pwshPath}`);
                return {
                    command: pwshPath,
                    arguments: [
                        '-NoLogo',
                        '-NoProfile',
                        '-NonInteractive',
                        '-ExecutionPolicy',
                        'Unrestricted',
                        '-Command',
                        command
                    ]
                }
            } catch (err) {
                const powershellPath = await which('powershell');

                console.log(`powershell pwsh at path: ${powershellPath}`);
                return {
                    command: powershellPath,
                    arguments: [
                        '-NoLogo',
                        '-Sta',
                        '-NoProfile',
                        '-NonInteractive',
                        '-ExecutionPolicy',
                        'Unrestricted',
                        '-Command',
                        command
                    ]
                }
            }
        }
        case 'python': {
            return {
                command: 'python',
                arguments: ['-u', '-c', command]
            }
        }
        case 'node': {
            return {
                command: 'node',
                arguments: ['-e', command] // aka --eval
            }
        }
        case 'cmd': {
            return {
                command: 'cmd.exe',
                arguments: ['/c', command]
            };
        }
        default:
        case 'none': {
            return null;
        }
    }
}

async function runWithTimeout(command: string, options?: { cwd?: string; failOnStdErr?: boolean; shell?: Shell; ignoreExitCodes?: number[]; timeout?: number; }): Promise<{ outcome: ExecutionResult, failCase?: string }> {
    options = Object.assign({
        cwd: process.cwd,
        failOnStdErr: false,
        shell: 'none',
        ignoreExitCodes: [],
    }, options ?? {});

    const commandLines = command.split('\n');

    if (!options.shell || options.shell == 'none') {
        for (const line of commandLines) {
            info(`Executing command: ${line}`)

            const result = await runCommandWithTimeout(line, {
                cwd: options.cwd,
                timeout: options.timeout,
            });

            if (options.failOnStdErr && result.stderr) {
                return {
                    outcome: ExecutionResult.Failure,
                    failCase: `Command ${line} standard error output was not empty`
                };
            }

            if (!result.timedOut && result.exitCode != 0 && options.ignoreExitCodes?.includes(result.exitCode)) {
                return {
                    outcome: ExecutionResult.Timeout,
                    failCase: "Return code was in ignore-return-codes list: $exitCode"
                };
            }

            if (result.timedOut) {
                return {
                    outcome: ExecutionResult.Timeout,
                    failCase: "'exec' timed out",
                }
            } else {
                if (result.timedOut) {
                    return {
                        outcome: ExecutionResult.Timeout,
                        failCase: `Command ${line} returned exit code: ${result.exitCode}`,
                    }
                }
            }
        }
    } else {
        info(`Executing command: ${command}`)

        const wrapped = await wrapInShell(command, options.shell);

        if (wrapped === null) throw new Error('huh');

        const result = await runCommandWithTimeout(wrapped, {
            cwd: options.cwd,
            timeout: options.timeout,
        });

        if (options.failOnStdErr && result.stderr) {
            return {
                outcome: ExecutionResult.Failure,
                failCase: `${options.shell} command ${command} standard error output was not empty`
            };
        }

        if (!result.timedOut && result.exitCode != 0 && options.ignoreExitCodes?.includes(result.exitCode)) {
            return {
                outcome: ExecutionResult.Timeout,
                failCase: "Return code was in ignore-return-codes list: $exitCode"
            };
        }

        if (result.timedOut) {
            return {
                outcome: ExecutionResult.Timeout,
                failCase: "'exec' timed out",
            }
        } else {
            if (result.timedOut) {
                return {
                    outcome: ExecutionResult.Timeout,
                    failCase: `${options.shell} command ${command} returned exit code: ${result.exitCode}`,
                }
            }
        }
    }

    return {
        outcome: ExecutionResult.Success,
        failCase: undefined
    };
}

async function runCommandWithTimeout(command: string | { command: string; arguments: string[]; }, options?: { cwd?: string; timeout?: number; }) {
    options = Object.assign({
        cwd: process.cwd,
        failOnStdErr: false,
    }, options ?? {});

    const commandArgs = typeof command === 'string' ? argStringToArray(command) : [command.command, ...command.arguments];
    if (commandArgs.length === 0) {
        throw new Error(`Parameter 'commandLine' cannot be null or empty.`);
    }
    // Path to tool to execute should be first arg
    const runner = new ToolRunner(commandArgs[0], [...commandArgs.slice(1)], { ...options, ignoreReturnCode: true });

    const proc = await runner.exec();

    const timeout = options?.timeout;
    if (timeout == null) {
        return { timedOut: false, exitCode: await proc.processClosedPromise, stderr: proc.processStderr };
    }

    const { timedOut } = await awaitWithTimeout(proc.processClosedPromise, timeout)
    if (!timedOut) { // did not time out
        return { timedOut: false, exitCode: proc.processExitCode, stderr: proc.processStderr };
    }

    proc.unref();
    await killCleanly(proc);
    return { timedOut: true, exitCode: proc.processExitCode, stderr: proc.processStderr };
}

async function killCleanly(proc: ExecPublicState) {
    // Wait to see if the process closes itself
    await delay(1000);
    if (proc.processExited) {
        return;
    }

    // if process is still running
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) { // attempt to send ctrl+break
        console.log(`Sending CTRL+BREAK to process ${inspect(proc)} attempt ${i+1} of ${maxRetries}`);
        await generateCtrlBreakAsync(proc.pid);
        await delay(3000);

        if (proc.processExited) {
            return;
        }
    }

    await awaitWithTimeout(proc.processClosedPromise, 10_000);
    if (proc.processExited) {
        return;
    }

    console.warn(`Killing process ${inspect(proc)}`);
    proc.kill(); // kill it with fire
}