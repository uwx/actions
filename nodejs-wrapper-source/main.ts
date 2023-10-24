require('source-map-support').install();

import { createWriteStream, constants as fsConstants } from "fs";
import { writeFile } from "fs/promises";
import { create as artifactClient } from "@actions/artifact";
import { restoreCache as restoreCache, saveCache as saveCache } from "@actions/cache";
import { debug as debug, getIDToken as getOpenIDConnectToken } from "@actions/core";
import { cacheDir, cacheFile, downloadTool, extract7z, extractTar, extractXar, extractZip, find as toolCacheFind, findAllVersions as toolCacheFindAllVersions } from "@actions/tool-cache";
import { promisify } from "util";

(async () => {
    const input = JSON.parse(process.argv[2]);
    const exchangeFilePath = process.argv[3];

    async function exchangeFileWrite(data: Record<string, unknown>): Promise<void> {
        await writeFile(exchangeFilePath, JSON.stringify(data), 'utf-8');
    }

    function resolveError(reason: string | Error | RangeError | ReferenceError | SyntaxError | TypeError): Promise<void> {
        const output: Record<string, unknown> = {
            isSuccess: false
        };
        if (typeof reason === "string") {
            output.reason = reason;
        } else {
            let message = `${reason.name}: ${reason.message}`;
            if (typeof reason.stack !== "undefined") {
                message += `\n${reason.stack}`;
            }
            output.reason = message;
        }
        return exchangeFileWrite(output);
    }

    function resolveResult(result: unknown): Promise<void> {
        return exchangeFileWrite({
            isSuccess: true,
            result
        });
    }

    try {
        switch (input.wrapperName) {
            case "$fail":
                debug(input.message);
                await resolveError("Test");
                break;
            case "$success":
                debug(input.message);
                await resolveResult("Hello, world!");
                break;
            case "artifact/download": {
                const result = await artifactClient().downloadArtifact(input.name, input.destination, { createArtifactFolder: input.createSubfolder });
                await resolveResult({
                    name: result.artifactName,
                    path: result.downloadPath
                });
                break;
            }
            case "artifact/download-all": {
                const result = await artifactClient().downloadAllArtifacts(input.destination);
                await resolveResult(result.map(value => ({
                    name: value.artifactName,
                    path: value.downloadPath
                })));
                break;
            }
            case "artifact/upload": {
                const result = await artifactClient().uploadArtifact(input.name, input.items, input.rootDirectory, {
                    continueOnError: input.continueOnError,
                    retentionDays: input.retentionDays
                });
                await resolveResult({
                    name: result.artifactName,
                    items: result.artifactItems,
                    size: result.size,
                    failedItems: result.failedItems
                });
                break;
            }
            case "cache/restore": {
                await resolveResult(await restoreCache(input.paths, input.primaryKey, input.restoreKeys, {
                    downloadConcurrency: input.downloadConcurrency,
                    lookupOnly: input.lookup,
                    segmentTimeoutInMs: input.segmentTimeout,
                    timeoutInMs: input.timeout,
                    useAzureSdk: input.useAzureSdk
                }) ?? null);
                break;
            }
            case "cache/save": {
                await resolveResult(await saveCache(input.paths, input.key, {
                    uploadChunkSize: input.uploadChunkSize,
                    uploadConcurrency: input.uploadConcurrency
                }));
                break;
            }
            case "open-id-connect/get-token": {
                await resolveResult(await getOpenIDConnectToken(input.audience));
                break;
            }
            case "tool-cache/cache-directory": {
                await resolveResult(await cacheDir(input.source, input.name, input.version, input.architecture));
                break;
            }
            case "tool-cache/cache-file": {
                await resolveResult(await cacheFile(input.source, input.target, input.name, input.version, input.architecture));
                break;
            }
            case "tool-cache/download-tool": {
                await resolveResult(await downloadTool(input.url, input.destination, input.authorization, input.headers));
                break;
            }
            case "tool-cache/extract-7z": {
                await resolveResult(await extract7z(input.file, input.destination, input["7zrPath"]));
                break;
            }
            case "tool-cache/extract-tar": {
                await resolveResult(await extractTar(input.file, input.destination, input.flags));
                break;
            }
            case "tool-cache/extract-xar": {
                await resolveResult(await extractXar(input.file, input.destination, input.flags));
                break;
            }
            case "tool-cache/extract-zip": {
                await resolveResult(await extractZip(input.file, input.destination));
                break;
            }
            case "tool-cache/find": {
                await resolveResult(toolCacheFind(input.name, input.version, input.architecture));
                break;
            }
            case "tool-cache/find-all-versions": {
                await resolveResult(toolCacheFindAllVersions(input.name, input.architecture));
                break;
            }
            default:
                await resolveError(`\`${input.wrapperName}\` is not a valid NodeJS wrapper name! Most likely a mistake made by the contributors, please report this issue.`);
                break;
        }
    } catch (error) {
        await resolveError(error);
    }
    await exchangeFileHandle.close();

})();