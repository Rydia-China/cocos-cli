import { Node, Vec3, MeshRenderer, Vec2 } from 'cc';

import EditableController from './editable';
import ControllerShape from '../utils/controller-shape';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import {
    setNodeOpacity,
    getModel,
    updatePositions,
    ProjectionType,
    FOVAxis,
} from '../utils/engine-utils';

const D2R = Math.PI / 180;

function deg2rad(deg: number): number {
    return deg * D2R;
}

const axisDirMap = ControllerUtils.axisDirectionMap;
const AxisName = ControllerUtils.AxisName;

const tempVec3 = new Vec3();

class FrustumController extends EditableController {
    private _aspect = 1;
    private _near = 1;
    private _far = 10;
    private _cameraProjection = 1; // 0:ortho,1:perspective

    // for perspective
    private _fov = 30; // degree
    private _fovAxis: number = FOVAxis.VERTICAL; // 0: Vertical, 1: horizontal
    // for ortho
    private _orthoHeight = 0;
    private _oriDir: Vec3 = new Vec3(0, 0, -1);

    private _deltaWidth = 0;
    private _deltaHeight = 0;
    private _deltaDistance = 0;
    private _mouseDeltaPos: Vec2 = new Vec2();
    private _curDistScalar = 0;

    private _frustumNode: Node | null = null;
    private _frustumMeshRenderer: MeshRenderer | null = null;

    constructor(rootNode: Node) {
        super(rootNode);

        // for edit
        this._editHandleKeys = [
            AxisName.x,
            AxisName.y,
            AxisName.neg_x,
            AxisName.neg_y,
            AxisName.neg_z,
        ];

        this.initShape();
    }

    getFarClipSize(isOrtho: boolean, orthoHeight: number, fov: number, aspect: number, far: number, fovAxis: number) {
        let farHalfHeight;
        let farHalfWidth;

        if (isOrtho) {
            farHalfHeight = orthoHeight;
            farHalfWidth = farHalfHeight * aspect;
        } else {
            if (fovAxis === FOVAxis.VERTICAL) {
                farHalfHeight = Math.tan(deg2rad(fov / 2)) * far;
                farHalfWidth = farHalfHeight * aspect;
            } else {
                farHalfWidth = Math.tan(deg2rad(fov / 2)) * far;
                farHalfHeight = farHalfWidth / aspect;
            }
        }

        return { farHalfHeight, farHalfWidth };
    }

    _updateEditHandle(axisName: string) {
        const node = this._handleDataMap[axisName].topNode;
        const dir = axisDirMap[axisName];

        const offset = new Vec3();
        Vec3.multiplyScalar(offset, this._oriDir, this._far);

        if (axisName !== 'neg_z') {
            const data = this.getFarClipSize(
                this._cameraProjection === ProjectionType.ORTHO,
                this._orthoHeight,
                this._fov,
                this._aspect,
                this._far,
                this._fovAxis,
            );

            if (axisName === 'x' || axisName === 'neg_x') {
                Vec3.multiplyScalar(tempVec3, dir, data.farHalfWidth);
            } else if (axisName === 'y' || axisName === 'neg_y') {
                Vec3.multiplyScalar(tempVec3, dir, data.farHalfHeight);
            }
            offset.add(tempVec3);
        }

        Vec3.multiply(offset, offset, this.getScale());
        node.setPosition(offset);
    }

    initShape() {
        this.createShapeNode('FrustumController');

        this._frustumNode = ControllerUtils.frustum(
            this._cameraProjection === ProjectionType.ORTHO,
            this._orthoHeight,
            this._fov,
            this._aspect,
            this._near,
            this._far,
            this._color,
            { forwardPipeline: true },
        );
        setNodeOpacity(this._frustumNode, 150);
        this._frustumNode!.parent = this.shape;
        this._frustumMeshRenderer = getModel(this._frustumNode);
        this.hide();
    }

    updateSize(camProj: number, orthoHeight: number, fov: number, aspect: number, near: number, far: number, fovAxis: number) {
        this._cameraProjection = camProj;
        this._orthoHeight = orthoHeight;
        this._fov = fov;
        this._aspect = aspect;
        this._near = near;
        this._far = far;
        this._fovAxis = fovAxis;

        const positions = ControllerShape.calcFrustum(
            this._cameraProjection === ProjectionType.ORTHO,
            this._orthoHeight,
            this._fov,
            this._aspect,
            this._near,
            this._far,
            this._fovAxis === FOVAxis.VERTICAL,
        ).positions;
        updatePositions(this._frustumMeshRenderer!, positions);

        if (this._edit) {
            this.updateEditHandles();
        }

        this.adjustEditHandlesSize();
    }

    // mouse events
    onMouseDown(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        this._mouseDeltaPos = new Vec2(0, 0);
        const hitNodePos = new Vec3();
        event.node && event.node.getWorldPosition(hitNodePos);
        this._curDistScalar = this.getCameraDistScalar(hitNodePos);
        this._deltaWidth = 0;
        this._deltaHeight = 0;
        this._deltaDistance = 0;

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

            const deltaDist = this.getAlignAxisMoveDistance(this.localToWorldDir(axisDir), this._mouseDeltaPos) * this._curDistScalar;
            if (event.handleName === 'neg_z') {
                this._deltaDistance = deltaDist;
            } else if (event.handleName === 'x' || event.handleName === 'neg_x') {
                this._deltaWidth = deltaDist;
            } else if (event.handleName === 'y' || event.handleName === 'neg_y') {
                this._deltaHeight = deltaDist;
            }

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

    getDeltaWidth() {
        return this._deltaWidth;
    }

    getDeltaHeight() {
        return this._deltaHeight;
    }

    getDeltaDistance() {
        return this._deltaDistance;
    }
}

export default FrustumController;
