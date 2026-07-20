'use strict';

import TransformBaseGizmo from './transform-base';
import RotationController from './rotation-controller';
import { Node, Vec3, Quat, CCObject } from 'cc';
import type { GizmoMouseEvent } from '../utils/defines';

/**
 * 获取 Service（惰性访问，避免循环依赖）
 */
function getService(): any {
    try {
        const { Service } = require('../../core/decorator');
        return Service;
    } catch (e) {
        return null;
    }
}

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

function deg2rad(deg: number): number {
    return deg * Math.PI / 180;
}

function toPrecision(val: number, n: number): number {
    const f = Math.pow(10, n);
    return Math.round(val * f) / f;
}

const q_a = new Quat();
const q_b = new Quat();
const q_c = new Quat();
const v3_a = new Vec3();
const v3_b = new Vec3();

let _controller: RotationController | null = null;

// 永远取小于 180 度方向的角度差
function minAngularDistance(a: Readonly<Vec3>, b: Readonly<Vec3>) {
    const x = Math.min(Math.abs(a.x - b.x), Math.abs((a.x < 0 ? 360 + a.x : a.x) - (b.x < 0 ? 360 + b.x : b.x)));
    const y = Math.min(Math.abs(a.y - b.y), Math.abs((a.y < 0 ? 360 + a.y : a.y) - (b.y < 0 ? 360 + b.y : b.y)));
    const z = Math.min(Math.abs(a.z - b.z), Math.abs((a.z < 0 ? 360 + a.z : a.z) - (b.z < 0 ? 360 + b.z : b.z)));
    return x + y + z;
}

class RotationGizmo extends TransformBaseGizmo {
    private _rotList: Array<Quat | number> = [];
    private _offsetList: Vec3[] = [];
    private _center: Vec3 = new Vec3(0, 0, 0);
    private _rotating = false;
    private _keydownDelta: number | null = null;
    private _curDeltaAngle = 0;
    private _curDeltaRotation: Quat = new Quat();

    isNodeLocked(node: Node) {
        if (!node) {
            return false;
        }
        return node.components.some((component: any) => component._objFlags & CCObject.Flags.IsRotationLocked);
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
            const rotCtrl = new RotationController(this.getGizmoRoot());
            this._controller = _controller = rotCtrl;
        }
        this._controller.onControllerMouseDown = this.onControllerMouseDown.bind(this);
        this._controller.onControllerMouseMove = this.onControllerMouseMove.bind(this);
        this._controller.onControllerMouseUp = this.onControllerMouseUp.bind(this);
    }

    onControllerMouseDown() {
        if (this._controller) {
            this._controller.isLock = this.nodes.some(node => this.isNodeLocked(node));
        }
        this._rotating = true;
        this._rotList = [];
        this._curDeltaAngle = 0;
        this._curDeltaRotation.set(0, 0, 0, 1);

        const nodes = this.nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const rot = nodes[i].getWorldRotation();
            this._rotList.push(rot);
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

        const snapConfigs = this._controller.transformToolData?.snapConfigs;
        if (snapConfigs) {
            const graduationInterval = Math.max(snapConfigs.rotation, 5);
            (this._controller as RotationController).setGraduation(graduationInterval);
        }

        // CLI: no pointer lock
    }

    onControllerMouseMove(event: any) {
        this.updateDataFromController(event);
    }

    onControllerMouseUp() {
        if (this._controller.transformToolData?.pivot === 'center') {
            const worldPos = getCenterWorldPos3D(this.nodes);
            this._controller.setPosition(worldPos);
            this._controller.setRotation(Quat.IDENTITY);
        }

        this._rotating = false;

        if (this._controller.updated) {
            this.onControlEnd('rotation');
        }

        // global模式下需要重置一下Controller的位置
        this.updateControllerTransform();
        // CLI: no pointer lock to exit
        (this._controller as RotationController).hideGraduation();
        this._curDeltaRotation.set(0, 0, 0, 1);
    }

    onKeyDown(event: any) {
        if (!this.nodes || this.nodes.length === 0) {
            return;
        }

        const keyCode = (event.key || '').toLowerCase();

        if (keyCode !== 'arrowleft' && keyCode !== 'arrowright' && keyCode !== 'arrowup' && keyCode !== 'arrowdown') {
            return super.onKeyDown(event);
        }

        this._rotating = true;

        let delta = event.shiftKey ? 10 : 1; // right and down
        if (keyCode === 'arrowright' || keyCode === 'arrowdown') {
            delta *= -1;
        }

        if (!this._keydownDelta) {
            this._keydownDelta = 0;
            const nodes = this.nodes;
            this._rotList = [];
            for (let i = 0; i < nodes.length; ++i) {
                this._rotList.push(nodes[i].angle);
            }
        }

        this._keydownDelta += delta;

        this._curDeltaAngle = this._keydownDelta;
        const radian = deg2rad(this._curDeltaAngle);
        Quat.fromAxisAngle(this._curDeltaRotation, Vec3.UNIT_Z, radian);

        this.onControlUpdate('rotation');

        this.updateRotationByZDeltaAngle(this._keydownDelta);
        repaintEngine();
        return false;
    }

    onKeyUp(event: any) {
        if (!this.nodes || this.nodes.length === 0) {
            return true;
        }

        const keyCode = (event.key || '').toLowerCase();

        if (keyCode !== 'arrowleft' && keyCode !== 'arrowright' && keyCode !== 'arrowup' && keyCode !== 'arrowdown') {
            return super.onKeyUp(event);
        }

        if (this._controller.transformToolData?.pivot === 'center') {
            const worldPos = getCenterWorldPos3D(this.nodes);
            this._controller.setPosition(worldPos);
            this._controller.setRotation(Quat.IDENTITY);
        }

        this._keydownDelta = null;
        this._rotating = false;

        this.onControlEnd('rotation');
        // global模式下需要重置一下Controller的位置
        this.updateControllerTransform();
        repaintEngine();
        return false;
    }

    updateDataFromController(event: GizmoMouseEvent) {
        this.updateDataFromController3D(event);
    }

    getLocalRotFromWorldRot(node: Node, worldRot: Quat, localRot: Quat) {
        if (node.parent) {
            node.parent.getWorldRotation(q_c);
            Quat.multiply(localRot, Quat.conjugate(q_c, q_c), worldRot);
        } else {
            Quat.copy(localRot, worldRot);
        }
        return localRot;
    }

    repeat(t: number, l: number) {
        return t - Math.floor(t / l) * l;
    }

    setNodeWorldRotation3D(node: Node, worldRot: Quat) {
        const localRot = q_b;
        this.getLocalRotFromWorldRot(node, worldRot, localRot);

        // 一个四元数对应两组欧拉角，需要找到与当前值最接近的那组
        const euler = node.eulerAngles;
        Quat.toEuler(v3_a, localRot, false);
        Quat.toEuler(v3_b, localRot, true);
        // 我们希望各角度在 (-180, 180) 间是连续的，在两个端点突变
        const newValue = minAngularDistance(v3_a, euler) < minAngularDistance(v3_b, euler) ? v3_a : v3_b;

        // 累加已有圈数
        newValue.x = this.repeat(newValue.x - euler.x + 180, 360) + euler.x - 180;
        newValue.y = this.repeat(newValue.y - euler.y + 180, 360) + euler.y - 180;
        newValue.z = this.repeat(newValue.z - euler.z + 180, 360) + euler.z - 180;

        // 避免浮点精度引起的序列化问题
        makeVec3InPrecision(newValue, 3);
        node.eulerAngles = newValue;
    }

    checkSnap(deltaRotation: Quat, deltaAngle: number, axisDir: Vec3, snapStep: number): Quat {
        this._curDeltaAngle = this.getSnappedValue(deltaAngle, snapStep);
        const radian = deg2rad(this._curDeltaAngle);
        Quat.fromAxisAngle(deltaRotation, axisDir, radian);
        return deltaRotation;
    }

    updateDataFromController3D(event: GizmoMouseEvent) {
        if (this._controller.updated) {
            this.onControlUpdate('rotation');

            let i;
            const rot = q_b;
            const rotationCtrl = this._controller as RotationController;
            this._curDeltaAngle = rotationCtrl.getDeltaAngle();
            const deltaRotation = rotationCtrl.getDeltaRotation();
            const nodes = this.nodes;

            const snapConfigs = this._controller.transformToolData?.snapConfigs;
            if (snapConfigs && (this.isControlKeyPressed(event) || snapConfigs.isRotationSnapEnabled)) {
                this.checkSnap(deltaRotation, rotationCtrl.getDeltaAngle(),
                    rotationCtrl.getHandleAxisDir(), snapConfigs.rotation);
                rotationCtrl.showGraduation();
            }

            Quat.copy(this._curDeltaRotation, deltaRotation);
            if (this._controller.transformToolData?.pivot === 'center') {
                for (i = 0; i < nodes.length; ++i) {
                    const curNodeMouseDownRot: Quat = this._rotList[i] as Quat;
                    if (curNodeMouseDownRot === null) {
                        return;
                    }

                    if (this._controller.transformToolData?.coordinate === 'global') {
                        Quat.multiply(rot, deltaRotation, curNodeMouseDownRot);
                    } else {
                        Quat.multiply(rot, curNodeMouseDownRot, deltaRotation);
                    }

                    const offsetPos = v3_b;
                    Vec3.transformQuat(offsetPos, this._offsetList[i], deltaRotation);
                    v3_a.set(this._center);
                    v3_a.add(offsetPos);
                    nodes[i].setWorldPosition(v3_a);
                    this.setNodeWorldRotation3D(nodes[i], rot);
                }
            } else {
                for (i = 0; i < nodes.length; ++i) {
                    if (this._controller.transformToolData?.coordinate === 'global') {
                        Quat.multiply(rot, deltaRotation, this._rotList[i] as Quat);
                    } else {
                        Quat.multiply(rot, this._rotList[i] as Quat, deltaRotation);
                    }
                    this.setNodeWorldRotation3D(nodes[i], rot);
                }
            }
        }
    }

    updateRotationByZDeltaAngle(zDeltaAngle: number) {
        let i;
        zDeltaAngle = toPrecision(zDeltaAngle, 3);
        const deltaRotation = q_a;
        const nodes = this.nodes;

        if (this._controller.transformToolData?.pivot === 'center') {
            for (i = 0; i < nodes.length; ++i) {
                const curNodeMouseDownRot: number = this._rotList[i] as number;
                if (curNodeMouseDownRot === null) {
                    return;
                }

                const newAngle = curNodeMouseDownRot + zDeltaAngle;
                nodes[i].angle = newAngle;
                Quat.fromEuler(deltaRotation, 0, 0, zDeltaAngle);
                const offsetPos = new Vec3();
                Vec3.transformQuat(offsetPos, this._offsetList[i], deltaRotation);
                v3_a.set(this._center);
                v3_a.add(offsetPos);
                nodes[i].setWorldPosition(v3_a);
            }
        } else {
            for (i = 0; i < nodes.length; ++i) {
                const newAngle = (this._rotList[i] as number) + zDeltaAngle;
                nodes[i].angle = newAngle;
            }
        }
    }

    updateControllerTransform() {
        const node = this.nodes[0];
        if (!node) {
            return;
        }

        let worldPos;
        const worldRot = q_a;
        Quat.identity(worldRot);
        if (this._controller.transformToolData?.pivot === 'center') {
            if (this._rotating) {
                return;
            }
            worldPos = getCenterWorldPos3D(this.nodes);
        } else {
            worldPos = node.getWorldPosition();
        }

        const rotCtrl = this._controller as RotationController;
        if (this._controller.transformToolData?.coordinate === 'global') {
            if (this._rotating) {
                Quat.copy(worldRot, this._curDeltaRotation);
            }
        } else {
            node.getWorldRotation(worldRot);
            this._controller.setRotation(worldRot);
        }

        if (this._rotating) {
            rotCtrl.updateRotationIndicator(rotCtrl.transformAxisDir, rotCtrl.indicatorStartDir,
                deg2rad(this._curDeltaAngle));
        }

        this._controller.setPosition(worldPos);
        this._controller.setRotation(worldRot);
    }
}

export default RotationGizmo;
