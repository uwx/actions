const exec = require('@actions/exec');
const path = require('path');

exec('pwsh', path.resolve(__dirname, 'index.ps1'));
