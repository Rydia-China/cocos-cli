import type { TGizmoType } from './types';
export { TGizmoType };
import { setGizmoProperty, getGizmoProperty } from './data';

type TPool<T> = Record<string, T[] | undefined>;

/**
 * Gizmo 注册表 — 其他模块将 Gizmo 类注册到此对象中
 */
export const GizmoDefines: {
    components: Record<string, new (...args: any[]) => any>;
    iconGizmo: Record<string, new (...args: any[]) => any>;
    persistentGizmo: Record<string, new (...args: any[]) => any>;
    methods: Record<string, { [name: string]: (...args: any[]) => void }>;
} = {
    components: {},
    iconGizmo: {},
    persistentGizmo: {},
    methods: {},
};

export class GizmoPool {
    private _transformPool: TPool<any> = {};
    private _componentsPool: TPool<any> = {};
    private _iconPool: TPool<any> = {};
    private _persistentPool: TPool<any> = {};

    private _getPool(type: TGizmoType) {
        const result: {
            pool: TPool<any>;
            typeDefs: Record<string, new (...args: any[]) => any>;
        } = {
            pool: {},
            typeDefs: {},
        };
        switch (type) {
            case 'component':
                result.pool = this._componentsPool;
                result.typeDefs = GizmoDefines.components;
                break;
            case 'icon':
                result.pool = this._iconPool;
                result.typeDefs = GizmoDefines.iconGizmo;
                break;
            case 'persistent':
                result.pool = this._persistentPool;
                result.typeDefs = GizmoDefines.persistentGizmo;
                break;
        }
        return result;
    }

    private unmountGizmo(gizmo: any) {
        if (gizmo.target) {
            const oldGizmo = getGizmoProperty('component', gizmo.target);
            if (oldGizmo === gizmo) setGizmoProperty('component', gizmo.target, null);
        }
        if (gizmo.target) {
            const oldIconGizmo = getGizmoProperty('icon', gizmo.target);
            if (oldIconGizmo === gizmo) setGizmoProperty('icon', gizmo.target, null);
        }
        if (gizmo.target) {
            const oldPersistentGizmo = getGizmoProperty('persistent', gizmo.target);
            if (oldPersistentGizmo === gizmo) setGizmoProperty('persistent', gizmo.target, null);
        }
        if (gizmo) gizmo.target = null;
    }

    public forEachInstanceList(type: TGizmoType, name: string, handle: (gizmo: any) => void) {
        const { pool } = this._getPool(type);
        const instanceList = pool[name];
        if (!instanceList) return;
        instanceList.forEach(handle);
    }

    public createGizmo(type: TGizmoType, name: string): any | null {
        const { pool, typeDefs } = this._getPool(type);
        if (!pool || !typeDefs) return null;
        const gizmoDef = typeDefs[name];
        let instanceList = pool[name];
        if (!instanceList) instanceList = pool[name] = [];
        if (instanceList && instanceList[0] && instanceList[0].constructor !== gizmoDef) {
            instanceList.forEach((instance: any) => instance.destroy());
            instanceList.length = 0;
        }
        if (!gizmoDef) return null;
        for (const instance of instanceList) {
            if (!instance.visible()) return instance;
        }
        const instance = new gizmoDef(null);
        instanceList.push(instance);
        return instance;
    }

    public destroyGizmo(gizmo: any): void {
        this.unmountGizmo(gizmo);
        gizmo.destroy();
        const list = [this._transformPool, this._componentsPool, this._iconPool, this._persistentPool];
        list.forEach(function(map) {
            for (const name in map) {
                const instanceList = map[name];
                if (!instanceList) continue;
                const index = instanceList.indexOf(gizmo);
                if (index !== -1) instanceList.splice(index, 1);
            }
        });
    }

    public clearAllGizmos(): void {
        const list = [this._transformPool, this._componentsPool, this._iconPool, this._persistentPool];
        list.forEach((map) => {
            for (const name in map) {
                const instanceList = map[name];
                instanceList && instanceList.forEach((gizmo: any) => {
                    this.unmountGizmo(gizmo);
                    gizmo.destroy();
                });
            }
        });
    }
}
