import { Component } from 'cc';
import { TGizmoType } from './types';

declare module 'cc' {
    export interface Node {
        gizmo: any | null;
        iconGizmo: any | null;
        persistentGizmo: any | null;
        noNeedCommitChanges?: boolean;
    }

    export interface Component {
        gizmo: any | null;
        iconGizmo: any | null;
        persistentGizmo: any | null;
    }
}

export function setGizmoProperty(type: TGizmoType, obj: Component, gizmo: any | null) {
    let key: 'gizmo' | 'persistentGizmo' | 'iconGizmo' = 'gizmo';
    if (type === 'persistent') {
        key = 'persistentGizmo';
    } else if (type === 'icon') {
        key = 'iconGizmo';
    }
    const oGizmo = (obj as any)[key];
    if (oGizmo) {
        oGizmo.target = null;
    }
    (obj as any)[key] = gizmo;
    if (gizmo) {
        gizmo.target = obj;
    }
}

export function getGizmoProperty(type: TGizmoType, obj: Component): any | null | undefined {
    let key: 'gizmo' | 'persistentGizmo' | 'iconGizmo' = 'gizmo';
    if (type === 'persistent') {
        key = 'persistentGizmo';
    } else if (type === 'icon') {
        key = 'iconGizmo';
    }
    return (obj as any)[key];
}
