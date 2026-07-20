'use strict';

import { Camera, js, Quat } from 'cc';
import GizmoBase from '../../base/gizmo-base';
import IconGizmoBase from '../../base/gizmo-icon';
import FrustumController from '../../controller/frustum';
import { ProjectionType, FOVAxis } from '../../utils/engine-utils';
import { registerGizmo } from '../../gizmo-defines';

const tempQuat_a = new Quat();

class CameraComponentGizmo extends GizmoBase<Camera> {
    private _controller!: FrustumController;
    private _fov = 0;
    private _near = 0;
    private _far = 0;
    private _aspect = 0;
    private _farHalfWidth = 0;
    private _farHalfHeight = 0;
    private _projection = 0;
    private _fovAxis: number = FOVAxis.VERTICAL;

    init() {
        this.createController();
        this._isInitialized = true;
    }

    onShow() {
        this._controller.show();
        this.updateControllerData();
    }

    onHide() {
        this._controller.hide();
    }

    createController() {
        const gizmoRoot = this.getGizmoRoot();
        this._controller = new FrustumController(gizmoRoot);
        this._controller.editable = true;
        this._controller.onControllerMouseDown = this.onControllerMouseDown.bind(this);
        this._controller.onControllerMouseMove = this.onControllerMouseMove.bind(this);
        this._controller.onControllerMouseUp = this.onControllerMouseUp.bind(this);
    }

    onControllerMouseDown() {
        if (!this._isInitialized || this.target == null) return;
        this._projection = this.target.projection;
        this._fov = this.target.fov;
        this._near = this.target.near;
        this._far = this.target.far;
        this._fovAxis = this.target.fovAxis;
        this._aspect = 16 / 9;
        if (this._projection === ProjectionType.PERSPECTIVE) {
            if (this._fovAxis === FOVAxis.VERTICAL) {
                this._farHalfHeight = Math.tan(this._fov / 2 * Math.PI / 180) * this._far;
                this._farHalfWidth = this._farHalfHeight * this._aspect;
            } else {
                this._farHalfWidth = Math.tan(this._fov / 2 * Math.PI / 180) * this._far;
                this._farHalfHeight = this._farHalfWidth / this._aspect;
            }
        } else {
            this._farHalfHeight = this.target.orthoHeight;
            this._farHalfWidth = this._farHalfHeight * this._aspect;
        }
        this.onControlBegin('');
    }

    onControllerMouseMove() {
        this.updateDataFromController();
    }

    onControllerMouseUp() {
        this.onControlEnd('');
    }

    updateDataFromController() {
        if (this._controller.updated) {
            const deltaWidth = this._controller.getDeltaWidth();
            const deltaHeight = this._controller.getDeltaHeight();
            const deltaDistance = this._controller.getDeltaDistance();
            let newHalfHeight = this._farHalfHeight;
            let newHalfWidth = this._farHalfWidth;
            if (deltaWidth !== 0) {
                newHalfWidth = this._farHalfWidth + deltaWidth;
                newHalfHeight = newHalfWidth / this._aspect;
            }
            if (deltaHeight !== 0) {
                newHalfHeight = this._farHalfHeight + deltaHeight;
                newHalfWidth = newHalfHeight * this._aspect;
            }
            let newFar = this._far;
            if (deltaDistance !== 0) {
                newFar = this._far + deltaDistance;
                newFar = Math.abs(newFar);
                if (newFar < this._near) newFar = this._near + 0.01;
                newFar = Math.round(newFar * 1000) / 1000;
            }
            newHalfHeight = Math.abs(newHalfHeight);
            const D2R = Math.PI / 180;
            const R2D = 180 / Math.PI;
            if (this._projection === ProjectionType.PERSPECTIVE) {
                let angle = this._fov;
                let halfLength = newHalfHeight;
                if (this._fovAxis === FOVAxis.HORIZONTAL) halfLength = newHalfWidth;
                if (newHalfHeight !== this._farHalfHeight || newHalfWidth !== this._farHalfWidth) {
                    angle = Math.atan2(halfLength, this._far) * 2;
                    if (angle < D2R) angle = D2R;
                    angle = angle * R2D;
                    angle = Math.round(angle * 1000) / 1000;
                }
                this.target!.fov = angle;
                this.target!.far = newFar;
            } else {
                newHalfHeight = Math.round(newHalfHeight * 1000) / 1000;
                this.target!.orthoHeight = newHalfHeight;
                this.target!.far = newFar;
            }
            this.target && this.onComponentChanged(this.target.node);
        }
    }

    updateControllerTransform() {
        if (this.target) {
            const node = this.target.node;
            const worldPos = node.getWorldPosition();
            const worldRot = tempQuat_a;
            node.getWorldRotation(worldRot);
            this._controller.setPosition(worldPos);
            this._controller.setRotation(worldRot);
        }
    }

    updateControllerData() {
        if (!this._isInitialized || this.target == null) return;
        if (this.target.node && !this.target.node.activeInHierarchy) return;
        const aspect = 16 / 9;
        this._controller.checkEdit();
        this._controller.updateSize(
            this.target.projection, this.target.orthoHeight, this.target.fov,
            aspect, this.target.near, this.target.far, this.target.fovAxis,
        );
        this.updateControllerTransform();
    }

    onTargetUpdate() {
        this.updateControllerData();
    }

    onNodeChanged() {
        this.updateControllerData();
    }
}

class CameraIconGizmo extends IconGizmoBase<Camera> {
    createController() {
        super.createController();
        this._controller.setTextureByUUID('bd373594-df84-486d-a34a-19d09ddaa973@6c48a');
    }
}

export const name = js.getClassName(Camera);
export const SelectGizmo = CameraComponentGizmo;
export const IconGizmo = CameraIconGizmo;
export const PersistentGizmo = null;

registerGizmo(name, { SelectGizmo, IconGizmo });
