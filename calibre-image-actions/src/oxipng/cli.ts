#!/usr/bin/env node

import { oxipngSync } from './app'

try {
    oxipngSync(process.argv.slice(2))
} catch (err: any) {
    if (typeof err.pid === 'number' && typeof err.status === 'number') {
        process.exit(err.status)
    }

    throw err
}
