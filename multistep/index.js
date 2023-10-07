// @ts-check

import { exec } from '@actions/exec';
import { resolve } from 'path';

exec('pwsh', [resolve(__dirname, 'index.ps1')]);