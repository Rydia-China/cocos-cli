'use strict';

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { remove } from 'fs-extra';
import { join } from 'path';
import { GlobalPaths } from '../../../../../global';
import { IBuildTaskOption } from '../../../@types';
/**
 * 清空项目相关的资源和脚本
 * @param projectPath
 */
export async function clearDest(projectPath: string) {
    try {
        await remove(join(projectPath, 'data'));
    } catch (err: any) {
        console.error(err);
    }
}

export async function getCmakePath(): Promise<string> {
    const internalCmakeRoot = join(GlobalPaths.staticDir, 'tools/cmake');
    const cmakePath = process.platform === 'win32'
        ? join(internalCmakeRoot, 'bin/cmake.exe')
        : join(internalCmakeRoot, 'bin/cmake');
    if (existsSync(cmakePath)) {
        return cmakePath;
    }

    const downloader = join(GlobalPaths.workspace, 'workflow/download-tools.js');
    if (existsSync(downloader)) {
        console.log('[native] bundled cmake missing, downloading cmake tool...');
        execFileSync(process.execPath, [downloader, '--only=cmake'], {
            cwd: GlobalPaths.workspace,
            stdio: 'inherit',
        });
        if (existsSync(cmakePath)) {
            return cmakePath;
        }
    }

    const systemCmake = process.platform === 'win32' ? 'cmake.exe' : 'cmake';
    try {
        execFileSync(systemCmake, ['--version'], { stdio: 'ignore' });
        console.warn(`[native] bundled cmake missing, using system cmake: ${systemCmake}`);
        return systemCmake;
    } catch {
        // Fall through to the expected bundled path so downstream error logs show the missing tool.
    }

    if (process.platform === 'win32') {
        return join(internalCmakeRoot, 'bin/cmake.exe');
    } else {
        return join(internalCmakeRoot, 'bin/cmake');
    }
}

// 支持中文的平台如果有修改，需要同步到 configs
export function acceptChineseName(options: IBuildTaskOption) {
    return ['mac', 'ios', 'windows', 'android'].includes(options.platform);
}

export function checkName(value: string, options: IBuildTaskOption) {
    if (acceptChineseName(options)) {
        return /^[\u4e00-\u9fa5A-Za-z0-9-_]+$/.test(value);
    } else {
        return /^[A-Za-z0-9-_]+$/.test(value);
    }
}
