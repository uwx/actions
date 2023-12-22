import { setFailed } from '@actions/core';

try {
    await import('./index_nodeonly');
} catch (err) {
    setFailed((err as Error).message);
}