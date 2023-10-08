// @ts-check

import { setFailed } from '@actions/core';
import { exec } from '@actions/exec';
import { resolve } from 'path';

exec('pwsh', ['-command', `. '${resolve(__dirname, 'index.ps1')}'`]).catch(err => setFailed(err.message));
