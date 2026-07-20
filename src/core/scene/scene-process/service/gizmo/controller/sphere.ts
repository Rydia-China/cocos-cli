import { Node, Quat, Vec3, Color, MeshRenderer, Vec2, Mat4 } from 'cc';

import EditableController from './editable';
import ControllerShape from '../utils/controller-shape';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import {
    setNodeOpacity,
    getModel,
    updatePositions,
    setMeshColor,
    getNodeOpacity,
} from '../utils/engine-utils';

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const D2R = Math.PI / 180;

/**
 * 获取编辑器摄像机组件（惰性访问避免循环依赖）
 */
function getEditorCamera(): any {
    try {
        const { Service } = require('../../core/decorator');
        return Service.Camera?.getCamera?.();
    } catch (e) {
        return null;
    }
}

const axisDirMap = ControllerUtils.axisDirectionMap;
const AxisName = ControllerUtils.AxisName;

const tempVec3_a = new Vec3();
const tempVec3_b = new Vec3();
const tempQuat_a = new Quat();

class SphereController extends EditableController {
    private _center: Vec3 = new Vec3();
    private _radius = 100;
    private _deltaRadius = 0;
    private _circleDataMap: any = {};
    private _borderCircle: Node | null = null;
    private _borderCircelMR: MeshRenderer | null = null;
    private _mouseDeltaPos: Vec2 = new Vec2();
    private _curDistScalar = 0;
    private _controlDir: Vec3 = new Vec3();

    constructor(rootNode: Node) {
        super(rootNode);

        this._color = Color.WHITE;

        this._editHandleKeys = Object.keys(axisDirMap);

        this.initShape();
    }

    get radius() {
        return this._radius;
    }
    set radius(value) {
        this.updateSize(this._center, value);
    }

    setColor(color: Color) {
        Object.keys(this._circleDataMap).forEach((key) => {
            const curData = this._circleDataMap[key];
            setMeshColor(curData.frontArcMR.node, color);
            const alpha = getNodeOpacity(curData.backArcMR.node);
            const newColor = color.clone();
            newColor.a = alpha;
            setMeshColor(curData.backArcMR.node, newColor);
        });

        setMeshColor(this._borderCircle!, color);
        this.setEditHandlesColor(color);

        this._color = color;
    }

    createCircleByAxis(axisName: string, fromAxisName: string, color: Color) {
        const normalDir = axisDirMap[axisName];
        const fromDir = axisDirMap[fromAxisName];
        const frontArcNode = ControllerUtils.arc(this._center, normalDir, fromDir, Math.PI * 2, this._radius, color);
        frontArcNode.name = 'arc_' + axisName + '_front';
        frontArcNode.parent = this.shape;

        const backArcNode = ControllerUtils.arc(this._center, normalDir, fromDir, Math.PI * 2, this._radius, color);
        backArcNode.name = 'arc_' + axisName + '_back';
        backArcNode.parent = this.shape;
        setNodeOpacity(backArcNode, 30);

        const axisData: any = {};
        axisData.frontArcMR = getModel(frontArcNode);
        axisData.backArcMR = getModel(backArcNode);
        axisData.normalDir = normalDir;
        axisData.fromDir = fromDir;
        this._circleDataMap[axisName] = axisData;
    }

    createBorderCircle() {
        this._borderCircle = ControllerUtils.circle(this._center, new Vec3(0, 0, 1), this._radius, this._color);
        this._borderCircle!.name = 'borderCircle';
        this._borderCircle!.parent = this.shape;
        this._borderCircelMR = getModel(this._borderCircle);
    }

    _updateEditHandle(axisName: string) {
        const node = this._handleDataMap[axisName].topNode;
        const dir = axisDirMap[axisName];

        const offset = new Vec3();
        Vec3.multiplyScalar(offset, dir, this._radius);

        const pos = new Vec3(offset);
        pos.add(this._center);
        Vec3.multiply(pos, pos, this.getScale());
        node.setPosition(pos.x, pos.y, pos.z);
    }

    initShape() {
        this.createShapeNode('SphereController');

        this._circleDataMap = {};

        this.createCircleByAxis('x', 'z', this._color);
        this.createCircleByAxis('y', 'x', this._color);
        this.createCircleByAxis('z', 'x', this._color);

        this.createBorderCircle();
        this.hide();

        const editorCamera = getEditorCamera();
        if (editorCamera?.node) {
            editorCamera.node.on('transform-changed', this.onEditorCameraMoved, this);
        }
    }

    updateSize(center: Vec3, radius: number) {
        this._center = center;
        this._radius = radius;

        if (this._edit) {
            this.updateEditHandles();
        }

        this.updateShape();
    }

    updateShape() {
        const editorCamera = getEditorCamera();
        if (!editorCamera?.node) return;

        const cameraPos = editorCamera.node.getWorldPosition();
        const mat = new Mat4();
        this.shape!.getWorldMatrix(mat);
        Mat4.invert(mat, mat);
        Vec3.transformMat4(cameraPos, cameraPos, mat); // convert camera pos to controller local space
        const cameraToCenterDir = tempVec3_b;

        Vec3.subtract(cameraToCenterDir, this._center, cameraPos);

        const sqrDist = Vec3.lengthSqr(cameraToCenterDir);
        const sqrRadius = this._radius * this._radius;
        const sqrOffset = (sqrRadius * sqrRadius) / sqrDist;
        const offsetPercent = sqrOffset / sqrRadius;
        // draw border circle
        // if outside of sphere
        if (offsetPercent < 1) {
            this._borderCircle!.active = true;
            const borderCicleRadius = Math.sqrt(sqrRadius - sqrOffset);

            const offsetVec = Vec3.multiplyScalar(tempVec3_a, cameraToCenterDir, sqrRadius / sqrDist);
            const borderCicleCenter = Vec3.subtract(tempVec3_a, this._center, offsetVec);
            const circlePoints = ControllerShape.calcCirclePoints(borderCicleCenter, cameraToCenterDir, borderCicleRadius);
            updatePositions(this._borderCircelMR!, circlePoints);
        } else {
            this._borderCircle!.active = false;
        }

        // draw axis-aligned circles
        Object.keys(this._circleDataMap).forEach((key) => {
            const normalDir = this._circleDataMap[key].normalDir;
            const frontArcMR = this._circleDataMap[key].frontArcMR;
            const backArcMR = this._circleDataMap[key].backArcMR;
            if (offsetPercent < 1) {
                let q = ControllerUtils.angle(cameraToCenterDir, normalDir);
                q = 90 - Math.min(q, 180 - q);
                const f = Math.tan(q * D2R);
                const g = Math.sqrt(sqrOffset + f * f * sqrOffset) / this._radius;
                if (g < 1) {
                    const e = Math.asin(g);
                    Vec3.cross(tempVec3_a, normalDir, cameraToCenterDir);
                    const from = tempVec3_a;
                    from.normalize();
                    const rot = tempQuat_a;
                    Quat.fromAxisAngle(rot, normalDir, e);
                    Vec3.transformQuat(from, from, rot);
                    this.updateArcMesh(frontArcMR, this._center, normalDir, from, (HALF_PI - e) * 2, this._radius);

                    frontArcMR.node.active = true;
                    this.updateArcMesh(
                        backArcMR,
                        this._center,
                        normalDir,
                        from,
                        (HALF_PI - e) * 2 - TWO_PI,
                        this._radius,
                    );
                } else {
                    this.updateArcMesh(
                        backArcMR,
                        this._center,
                        normalDir,
                        this._circleDataMap[key].fromDir,
                        TWO_PI,
                        this._radius,
                    );
                    frontArcMR.node.active = false;
                }
            } else {
                this.updateArcMesh(backArcMR, this._center, normalDir, this._circleDataMap[key].fromDir, TWO_PI, this._radius);
                frontArcMR.node.active = false;
            }
        });

        this.adjustEditHandlesSize();
    }

    updateArcMesh(model: MeshRenderer, center: Vec3, normal: Vec3, from: Vec3, radian: number, radius: number) {
        const arcPositions = ControllerShape.calcArcPoints(center, normal, from, radian, radius);

        updatePositions(model, arcPositions);
    }

    onEditorCameraMoved() {
        this.updateShape();
    }

    // mouse events
    onMouseDown(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        this._mouseDeltaPos = new Vec2(0, 0);
        this._curDistScalar = super.getDistScalar();
        this._controlDir = new Vec3(0, 0, 0);

        if (this.onControllerMouseDown) {
            this.onControllerMouseDown(event);
        }
    }

    onMouseMove(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this._isMouseDown) {
            this._mouseDeltaPos.x += event.moveDeltaX;
            this._mouseDeltaPos.y += event.moveDeltaY;

            const axisDir = axisDirMap[event.handleName];
            this._controlDir = axisDir;
            this._deltaRadius = this.getAlignAxisMoveDistance(this.localToWorldDir(axisDir), this._mouseDeltaPos) * this._curDistScalar;

            if (this.onControllerMouseMove) {
                this.onControllerMouseMove(event);
            }
        }
    }

    onMouseUp(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this.onControllerMouseUp) {
            this.onControllerMouseUp(event);
        }
    }

    onMouseLeave(event: GizmoMouseEvent) {
        this.onMouseUp(event);
    }
    // mouse events end

    getDeltaRadius() {
        return this._deltaRadius;
    }

    getControlDir() {
        return this._controlDir;
    }
}

export default SphereController;
