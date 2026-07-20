import path from 'path';

import { TypeScriptConfigBuilder } from '../intelligence';

describe('TypeScriptConfigBuilder', () => {
    it('writes declaration type paths relative to the generated config', () => {
        const projectPath = path.resolve('virtual-project');
        const builder = new TypeScriptConfigBuilder(projectPath, path.join(projectPath, 'engine'));
        const declarationPath = path.join(projectPath, 'temp', 'declarations', 'cc.d.ts');

        expect((builder as any).tsConfigTypePath(declarationPath)).toBe('./declarations/cc');
    });
});
