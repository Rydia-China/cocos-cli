#!/usr/bin/env node
// Host asset tools only. No Xcode, Android SDK/NDK, Java, or native app builds.
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, chmodSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Linux Bundle tools currently support linux-x64 only.');
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'bundle-tools-'));
const tools = [
    { url: 'https://github.com/ARM-software/astc-encoder/releases/download/5.2.0/astcenc-5.2.0-linux-x64.zip', sha256: 'b8c805b3c4a32680287ad5e5fc2a8b5ddf78c80f24cc0ec7ed1e4eb03c6cc5d2', format: 'zip', executable: 'astcenc-sse2', target: 'static/tools/astc-encoder/astcenc' },
    { url: 'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0-linux-x86-64.tar.gz', sha256: '94ac053be5f8cb47a493d7a56b2b1b7328bab9cff24ecb89fa642284330d8dff', format: 'tgz', executable: 'cwebp', target: 'static/tools/libwebp_linux/bin/cwebp' },
];
function find(dir, name) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { const found = find(path, name); if (found) return found; }
        else if (entry.name === name) return path;
    }
}
try {
    for (const [index, tool] of tools.entries()) {
        const archive = join(temp, `${index}.${tool.format}`), extracted = join(temp, String(index));
        execFileSync('curl', ['--fail', '--location', '--retry', '3', '--max-time', '180', '--output', archive, tool.url], { stdio: 'inherit' });
        if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== tool.sha256) throw new Error(`Checksum mismatch: ${tool.url}`);
        mkdirSync(extracted);
        execFileSync(tool.format === 'zip' ? 'unzip' : 'tar', tool.format === 'zip' ? ['-q', archive, '-d', extracted] : ['-xzf', archive, '-C', extracted]);
        const source = find(extracted, tool.executable);
        if (!source) throw new Error(`Missing ${tool.executable} in verified archive`);
        const target = resolve(root, tool.target);
        mkdirSync(resolve(target, '..'), { recursive: true }); copyFileSync(source, target); chmodSync(target, 0o755);
        console.log(`Installed ${tool.target} (${tool.sha256})`);
    }
} finally { rmSync(temp, { recursive: true, force: true }); }
