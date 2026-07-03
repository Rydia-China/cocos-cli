#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const repoConfigPath = path.join(rootDir, 'repo.json');
const args = new Set(process.argv.slice(2));
const force = args.has('--force') || process.env.LUNAVERSE_BUILD_RUNNER_FORCE_ENGINE_SETUP === '1';
const skipEngineBuild = args.has('--skip-engine-build') || process.env.LUNAVERSE_BUILD_RUNNER_SKIP_ENGINE_BUILD === '1';
const skipEngineNpmInstall = args.has('--skip-npm-install') || process.env.LUNAVERSE_BUILD_RUNNER_SKIP_ENGINE_NPM_INSTALL === '1';

main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});

async function main() {
    const config = readRepoConfig();
    const engine = requireConfig(config.engine, 'engine');
    const external = requireConfig(config.external, 'external');

    console.log('Setting up Lunaverse build runner runtime engine');
    console.log(`Runner root: ${rootDir}`);

    ensureRepo('engine', engine, {
        marker: 'package.json',
    });
    ensureRepo('external', external, {
        marker: 'CMakeLists.txt',
    });

    if (skipEngineBuild) {
        console.log('Skipping engine build because --skip-engine-build was provided.');
    } else {
        await ensureEngineBuild(engine);
    }

    verifyRuntime(engine, external);
    console.log('Lunaverse build runner runtime engine is ready.');
}

function readRepoConfig() {
    if (!fs.existsSync(repoConfigPath)) {
        throw new Error(`Missing repo config: ${repoConfigPath}`);
    }
    return JSON.parse(fs.readFileSync(repoConfigPath, 'utf8'));
}

function requireConfig(config, name) {
    if (!config || !config.repo || !config.dist || (!config.branch && !config.tag)) {
        throw new Error(`Invalid ${name} repo config in ${repoConfigPath}`);
    }
    return config;
}

function ensureRepo(name, config, options) {
    const targetDir = path.resolve(rootDir, config.dist);
    const marker = path.join(targetDir, options.marker);
    const expectedCommit = config.commit || '';

    if (!force && fs.existsSync(marker) && (!expectedCommit || repoHeadMatches(targetDir, expectedCommit))) {
        console.log(`${name} repo already ready at ${shortCommit(expectedCommit || repoHead(targetDir))}: ${targetDir}`);
        return;
    }

    if (fs.existsSync(targetDir)) {
        console.log(`Removing stale ${name} repo: ${targetDir}`);
        fs.rmSync(targetDir, { recursive: true, force: true });
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    const refName = config.branch || config.tag;
    const cloneArgs = ['clone', '--depth', '1', '--branch', refName, config.repo, targetDir];
    run('git', cloneArgs, { cwd: rootDir });

    if (!fs.existsSync(marker)) {
        throw new Error(`${name} repo clone did not create required marker: ${marker}`);
    }
    if (expectedCommit) {
        const actualCommit = repoHead(targetDir);
        if (actualCommit !== expectedCommit) {
            throw new Error(`${name} repo commit mismatch. Expected ${expectedCommit}, got ${actualCommit}`);
        }
    }
}

async function ensureEngineBuild(engineConfig) {
    const engineDir = path.resolve(rootDir, engineConfig.dist);
    const engineNodeModules = path.join(engineDir, 'node_modules');
    const declarationFile = path.join(engineDir, 'bin', '.declarations', 'cc.d.ts');
    const nativePackTool = path.join(engineDir, 'scripts', 'native-pack-tool', 'dist', 'index.js');

    if (skipEngineNpmInstall) {
        console.log('Skipping engine npm install because --skip-npm-install was provided.');
    } else if (fs.existsSync(engineNodeModules) && fs.existsSync(declarationFile) && fs.existsSync(nativePackTool)) {
        console.log('Engine npm install outputs already exist; skipping npm install.');
    } else {
        runNpm(['install'], { cwd: engineDir });
    }

    const devCliDir = path.join(engineDir, 'bin', '.cache', 'dev-cli');
    if (fs.existsSync(devCliDir)) {
        console.log(`Engine dev cache already exists: ${devCliDir}`);
        return;
    }

    const compilerPath = path.join(rootDir, 'packages', 'engine-compiler', 'dist', 'index.js');
    if (!fs.existsSync(compilerPath)) {
        throw new Error(`Missing packaged engine compiler: ${compilerPath}`);
    }
    const { compileEngine } = require(compilerPath);
    console.log('Compiling engine cache for native/editor runtime...');
    await compileEngine(engineDir);
    console.log('Compiling engine cache for web runtime...');
    await compileEngine(engineDir, true);
}

function verifyRuntime(engineConfig, externalConfig) {
    const requiredPaths = [
        path.resolve(rootDir, engineConfig.dist, 'package.json'),
        path.resolve(rootDir, engineConfig.dist, 'native', 'CMakeLists.txt'),
        path.resolve(rootDir, externalConfig.dist, 'CMakeLists.txt'),
        path.resolve(rootDir, 'packages', 'engine-compiler', 'dist', 'index.js'),
    ];
    if (!skipEngineBuild) {
        requiredPaths.push(path.resolve(rootDir, engineConfig.dist, 'bin', '.cache', 'dev-cli'));
    }

    for (const requiredPath of requiredPaths) {
        if (!fs.existsSync(requiredPath)) {
            throw new Error(`Runtime engine setup missing required path: ${requiredPath}`);
        }
    }
}

function repoHeadMatches(repoDir, expectedCommit) {
    try {
        return repoHead(repoDir) === expectedCommit;
    } catch {
        return false;
    }
}

function repoHead(repoDir) {
    return runCapture('git', ['rev-parse', 'HEAD'], { cwd: repoDir }).trim();
}

function shortCommit(commit) {
    return commit ? commit.slice(0, 12) : 'unknown';
}

function runNpm(npmArgs, options) {
    const env = { ...process.env };
    const macosSdk = runCaptureOrEmpty('xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
    if (macosSdk) {
        env.SDKROOT = macosSdk.trim();
    } else {
        delete env.SDKROOT;
    }
    run(npmCommand(), npmArgs, { ...options, env });
}

function npmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function run(command, commandArgs, options = {}) {
    console.log(`$ ${[command, ...commandArgs].join(' ')}`);
    const result = spawnSync(command, commandArgs, {
        cwd: options.cwd || rootDir,
        env: options.env || process.env,
        stdio: 'inherit',
        shell: false,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} exited with code ${result.status}`);
    }
}

function runCapture(command, commandArgs, options = {}) {
    const result = spawnSync(command, commandArgs, {
        cwd: options.cwd || rootDir,
        env: options.env || process.env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim();
        throw new Error(`${command} exited with code ${result.status}${detail ? `: ${detail}` : ''}`);
    }
    return result.stdout;
}

function runCaptureOrEmpty(command, commandArgs, options = {}) {
    try {
        return runCapture(command, commandArgs, options);
    } catch {
        return '';
    }
}
