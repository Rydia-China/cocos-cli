const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'dist', 'cli.js');
const packageMetadata = require(path.join(projectRoot, 'package.json'));
const ifPresent = process.argv.includes('--if-present');
const permissionsOnly = process.argv.includes('--permissions-only');

if (!fs.existsSync(cliPath)) {
    if (ifPresent) {
        console.log(`CLI entry is not built yet; skipped: ${cliPath}`);
        process.exit(0);
    }
    throw new Error(`Missing compiled CLI entry: ${cliPath}`);
}

const contents = fs.readFileSync(cliPath, 'utf8');
if (!contents.startsWith('#!/usr/bin/env node')) {
    throw new Error(`Compiled CLI entry is missing its Node shebang: ${cliPath}`);
}

if (process.platform !== 'win32') {
    const currentMode = fs.statSync(cliPath).mode;
    fs.chmodSync(cliPath, currentMode | 0o111);
    const executableMode = fs.statSync(cliPath).mode;
    if ((executableMode & 0o111) === 0) {
        throw new Error(`Compiled CLI entry is not executable: ${cliPath}`);
    }
}

if (!permissionsOnly) {
    const result = spawnSync(process.execPath, [cliPath, '--version'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
            ...process.env,
            NO_COLOR: '1',
        },
    });
    if (result.status !== 0) {
        throw new Error([
            `Compiled CLI version check failed with exit ${result.status}.`,
            result.stderr?.trim(),
            result.stdout?.trim(),
        ].filter(Boolean).join('\n'));
    }
    const actualVersion = result.stdout.trim();
    if (actualVersion !== packageMetadata.version) {
        throw new Error(`Compiled CLI version mismatch: package=${packageMetadata.version} cli=${actualVersion || '(empty)'}`);
    }
}

console.log(`CLI entry verified: ${cliPath} version=${packageMetadata.version}`);
