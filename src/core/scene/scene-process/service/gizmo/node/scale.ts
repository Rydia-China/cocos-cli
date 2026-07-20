'use strict';

import TransformBaseGizmo from './transform-base';
import ScaleController from './scale-controller';
import { Node, Vec3, Quat, CCObject } from 'cc';
import type { GizmoMouseEvent } from '../utils/defines';

function repaintEngine(): void {
    try {
        const { Service } = require('../../core/decorator');
        Service.Engine?.repaintInEditMode?.();
    } catch (e) {
        // not ready
    }
}

function makeVec3InPrecision(v: Vec3, p: number): Vec3 {
    const f = Math.pow(10, p);
    v.x = Math.round(v.x * f) / f;
    v.y = Math.round(v.y * f) / f;
    v.z = Math.round(v.z * f) / f;
    return v;
}

function getCenterWorldPos3D(nodes: Node[]): Vec3 {
    const center = new Vec3();
    if (nodes.length === 0) return center;
    for (const node of nodes) {
        const wp = node.getWorldPosition();
        center.add(wp);
    }
    center.multiplyScalar(1 / nodes.length);
    return center;
}

const tempQuat_a = new Quat();

let _controller: ScaleController | null = null;

class ScaleGizmo extends TransformBaseGizmo {
    private _localScaleList: Vec3[] = [];
    private _offsetList: Vec3[] = [];
    private _center: Vec3 = new Vec3();

    isNodeLocked(node: Node): boolean {
        if (!node) {
            return false;
        }
        return node.components.some((component: any) => component._objFlags & CCObject.Flags.IsScaleLocked);
    }

    init() {
        this.createController();
    }

    layer() {
        return 'foreground';
    }

    onTargetUpdate() {
        if (_controller) {
            this._controller = _controller;
            _controller.onControllerMouseDown = this.onControllerMouseDown.bind(this);
            _controller.onControllerMouseMove = this.onControllerMouseMove.bind(this);
            _controller.onControllerMouseUp = this.onControllerMouseUp.bind(this);
        }
        super.onTargetUpdate();
    }

    createController() {
        if (_controller) {
            this._controller = _controller;
        } else {
            this._controller = _controller = new ScaleController(this.getGizmoRoot());
        }

        this._controller.onControllerMouseDown = this.onControllerMouseDown.bind(this);
        this._controller.onControllerMouseMove = this.onControllerMouseMove.bind(this);
        this._controller.onControllerMouseUp = this.onControllerMouseUp.bind(this);
    }

    onControllerMouseDown() {
        if (this._controller) {
            this._controller.isLock = this.nodes.some(node => this.isNodeLocked(node));
        }
        this._localScaleList = [];

        const nodes = this.nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            const scale = new Vec3();
            node.getScale(scale);
            this._localScaleList.push(scale);
        }

        if (this._controller.transformToolData?.pivot === 'center') {
            this._center = getCenterWorldPos3D(this.nodes);
            this._offsetList.length = 0;
            for (let i = 0; i < nodes.length; ++i) {
                const nodeWorldPos = nodes[i].getWorldPosition();
                const out = new Vec3(nodeWorldPos);
                out.subtract(this._center);
                this._offsetList.push(out);
            }
        }
    }

    onControllerMouseMove(event: GizmoMouseEvent) {
        this.updateDataFromController(event);
    }

    onControllerMouseUp() {
        if (this._controller.updated) {
            this.onControlEnd('scale');
        }
    }

    onKeyDown(event: any) {
        if (!this.nodes || this.nodes.length === 0) {
            return true;
        }

        const keyCode = (event.key || '').toLowerCase();

        if (keyCode !== 'arrowleft' && keyCode !== 'arrowright' && keyCode !== 'arrowup' && keyCode !== 'arrowdown') {
            return super.onKeyDown(event);
        }

        const offset = event.shiftKey ? 1 : 0.1;
        const dif = { x: 0, y: 0 };
        if (keyCode === 'arrowleft') {
            dif.x = offset * -1;
        } else if (keyCode === 'arrowright') {
            dif.x = offset;
        } else if (keyCode === 'arrowup') {
            dif.y = offset;
        } else if (keyCode === 'arrowdown') {
            dif.y = offset * -1;
        }

        this.onControlUpdate('scale');

        const curScale = new Vec3();
        this.nodes.forEach((node: Node) => {
            node.getScale(curScale);
            curScale.x = curScale.x + dif.x;
            curScale.y = curScale.y + dif.y;
            this.setScaleWithPrecision(node, curScale, 3);
        });

        repaintEngine();
        return false;
    }

    onKeyUp(event: any) {
        if (!this.nodes) {
            return true;
        }

        const keyCode = (event.key || '').toLowerCase();

        if (keyCode !== 'arrowleft' && keyCode !== 'arrowright' && keyCode !== 'arrowup' && keyCode !== 'arrowdown') {
            return super.onKeyUp(event);
        }

        this.onControlEnd('scale');
        return false;
    }

    setScaleWithPrecision(node: Node, newScale: Vec3, precision: number) {
        newScale = makeVec3InPrecision(newScale, precision);
        node.setScale(newScale.x, newScale.y, newScale.z);
    }

    checkSnap(scaleDelta: Vec3, snapStep: number) {
        const scaleCtrl = this._controller as ScaleController;
        const moveAxisName = scaleCtrl.moveAxisName;
        if (moveAxisName) {
            let deltaScale = 0;
            if (moveAxisName === 'xyz') {
                deltaScale = scaleDelta.x;
            } else {
                deltaScale = (scaleDelta as any)[moveAxisName];
            }

            deltaScale = this.getSnappedValue(deltaScale, snapStep);

            if (moveAxisName === 'xyz') {
                scaleDelta.x = deltaScale;
                scaleDelta.y = deltaScale;
                scaleDelta.z = deltaScale;
            } else {
                (scaleDelta as any)[moveAxisName] = deltaScale;
            }

            const deltaDist = deltaScale * scaleCtrl.scaleFactor;
            scaleCtrl.onAxisSliderMove(moveAxisName, deltaDist);
        }
    }

    updateDataFromController(event: GizmoMouseEvent) {
        if (this._controller.updated) {
            this.onControlUpdate('scale');

            let i;
            const scaleCtrl = this._controller as ScaleController;
            const scaleDelta = scaleCtrl.getDeltaScale();
            const snapConfigs = this._controller.transformToolData?.snapConfigs;
            // check snap
            if (snapConfigs && (this.isControlKeyPressed(event) || snapConfigs.isScaleSnapEnabled)) {
                this.checkSnap(scaleDelta, snapConfigs.scale);
            }
            const scale = new Vec3(1.0 + scaleDelta.x, 1.0 + scaleDelta.y, 1.0 + scaleDelta.z);
            const newScale = new Vec3();
            const nodes = this.nodes;

            const curNodePos = new Vec3();
            for (i = 0; i < this._localScaleList.length; ++i) {
                newScale.x = this._localScaleList[i].x * scale.x;
                newScale.y = this._localScaleList[i].y * scale.y;
                newScale.z = this._localScaleList[i].z * scale.z;
                this.setScaleWithPrecision(nodes[i], newScale, 3);
                if (this._controller.transformToolData?.pivot === 'center') {
                    const offset = new Vec3(
                        this._offsetList[i].x * scale.x,
                        this._offsetList[i].y * scale.y,
                        this._offsetList[i].z * scale.z,
                    );
                    curNodePos.set(this._center);
                    curNodePos.add(offset);
                    nodes[i].setWorldPosition(curNodePos);
                }
            }
        }
    }

    updateControllerTransform() {
        const node = this.nodes[0];
        if (!node) {
            return;
        }

        let worldPos;
        const worldRot = tempQuat_a;

        if (this._controller.transformToolData?.pivot === 'center') {
            worldPos = getCenterWorldPos3D(this.nodes);
        } else {
            worldPos = node.getWorldPosition();
        }

        node.getWorldRotation(worldRot);

        this._controller.setPosition(worldPos);
        this._controller.setRotation(worldRot);
    }
}

export default ScaleGizmo;
