import { setFailed } from '@actions/core';

import { install } from 'source-map-support';

install();

try {
    await import('./index_nodeonly');
} catch (err) {
    setFailed((err as Error).message);
}