'use strict';

import { Component } from 'cc';
import TransformGizmo from './node/transform';
import GizmoBase from './base/gizmo-base';

const GizmoDefines: {
    components: Map<string, new (target: Component | null) => GizmoBase>;
    iconGizmo: Map<string, new (target: Component | null) => GizmoBase>;
    persistentGizmo: Map<string, new (target: Component | null) => GizmoBase>;
    methods: Map<string, { [name: string]: (...args: any[]) => void }>;
} = {
    components: new Map([
        ['_EditorHackTransformComponent_', TransformGizmo as any],
    ]),
    iconGizmo: new Map(),
    persistentGizmo: new Map(),
    methods: new Map(),
};

export function registerGizmo(name: string, options: {
    SelectGizmo?: any;
    IconGizmo?: any;
    PersistentGizmo?: any;
    methods?: any;
}) {
    if (options.SelectGizmo) GizmoDefines.components.set(name, options.SelectGizmo);
    if (options.IconGizmo) GizmoDefines.iconGizmo.set(name, options.IconGizmo);
    if (options.PersistentGizmo) GizmoDefines.persistentGizmo.set(name, options.PersistentGizmo);
    if (options.methods) GizmoDefines.methods.set(name, options.methods);
}

export default GizmoDefines;
