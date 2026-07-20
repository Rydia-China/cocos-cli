'use strict';

import { BoxCollider, Color, js, Quat, Vec3 } from 'cc';
import GizmoBase from '../../base/gizmo-base';
import BoxController from '../../controller/box';
import { registerGizmo } from '../../gizmo-defines';

const tempVec3 = new Vec3();
const tempQuat_a = new Quat();

class BoxColliderComponentGizmo extends GizmoBase<BoxCollider> {
    private _controller!: BoxController;
    private _size: Vec3 = new Vec3();
    private _scale: Vec3 = new Vec3();
    private _propPath: string | null = null;

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
        this._controller = new BoxController(gizmoRoot);
        this._controller.setColor(Color.GREEN);
        this._controller.editable = true;
        this._controller.hoverColor = Color.YELLOW;
        this._controller.onControllerMouseDown = this.onControllerMouseDown.bind(this);
        this._controller.onControllerMouseMove = this.onControllerMouseMove.bind(this);
        this._controller.onControllerMouseUp = this.onControllerMouseUp.bind(this);
    }

    onControllerMouseDown() {
        if (!this._isInitialized || this.target === null) return;
        this._size = this.target.size.clone();
        this._scale = this.target.node.getWorldScale();
        this._propPath = this.getCompPropPath('size');
    }

    onControllerMouseMove() {
        this.updateDataFromController();
    }

    onControllerMouseUp() {
        this.onControlEnd(this._propPath);
    }

    updateDataFromController() {
        if (this._controller.updated && this.target) {
            this.onControlUpdate(this._propPath);
            const deltaSize = this._controller.getDeltaSize();
            Vec3.divide(deltaSize, deltaSize, this._scale);
            Vec3.multiplyScalar(deltaSize, deltaSize, 2);
            const newSize = Vec3.add(tempVec3, this._size, deltaSize);
            newSize.x = Math.max(0, newSize.x);
            newSize.y = Math.max(0, newSize.y);
            newSize.z = Math.max(0, newSize.z);
            this.target.size = newSize;
            this.onComponentChanged(this.target.node);
        }
    }

    updateControllerTransform() {
        this.updateControllerData();
    }

    updateControllerData() {
        if (!this._isInitialized || this.target == null) return;
        if (this.target instanceof BoxCollider) {
            const node = this.target.node;
            this._controller.show();
            this._controller.checkEdit();
            const worldScale = node.getWorldScale();
            const worldPos = node.getWorldPosition();
            const worldRot = tempQuat_a;
            node.getWorldRotation(worldRot);
            this._controller.setScale(worldScale);
            this._controller.setPosition(worldPos);
            this._controller.setRotation(worldRot);
            this._controller.updateSize(this.target.center, this.target.size);
        } else {
            this._controller.hide();
        }
    }

    onTargetUpdate() {
        this.updateControllerData();
    }

    onNodeChanged() {
        this.updateControllerData();
    }
}

export const name = js.getClassName(BoxCollider);
export const SelectGizmo = BoxColliderComponentGizmo;
export const IconGizmo = null;
export const PersistentGizmo = null;

registerGizmo(name, { SelectGizmo });
