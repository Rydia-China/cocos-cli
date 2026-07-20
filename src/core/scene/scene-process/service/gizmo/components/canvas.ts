'use strict';

import { Canvas, Color, js, MeshRenderer, Quat, UITransform, Vec2, Vec3 } from 'cc';
import GizmoBase from '../base/gizmo-base';
import { registerGizmo } from '../gizmo-defines';
import ControllerUtils from '../utils/controller-utils';
import ControllerShape from '../utils/controller-shape';
import { getModel, updatePositions } from '../utils/engine-utils';

const tempQuat = new Quat();

class CanvasPersistentGizmo extends GizmoBase<Canvas> {
    private _rectNode: any = null;
    private _rectMR: MeshRenderer | null = null;

    init() {
        const gizmoRoot = this.getGizmoRoot();
        if (!gizmoRoot) return;
        this._rectNode = ControllerUtils.rectangle(
            Vec3.ZERO, Quat.IDENTITY, new Vec2(1, 1), Color.WHITE, { unlit: true },
        );
        this._rectNode.parent = gizmoRoot;
        this._rectNode.active = false;
        this._rectMR = getModel(this._rectNode);
    }

    onShow() {
        if (this._rectNode) {
            this._rectNode.active = true;
        }
        this._updateRect();
    }

    onHide() {
        if (this._rectNode) {
            this._rectNode.active = false;
        }
    }

    onTargetUpdate() {
        this._updateRect();
    }

    onNodeChanged() {
        this._updateRect();
    }

    onUpdate() {
        this._updateRect();
    }

    private _updateRect() {
        if (!this.target || !this._rectNode || !this._rectMR) return;
        const node = this.target.node;
        if (!node || !node.activeInHierarchy) {
            this._rectNode.active = false;
            return;
        }

        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            this._rectNode.active = false;
            return;
        }

        const size = uiTransform.contentSize;
        const rectData = ControllerShape.calcRectanglePoints(Vec3.ZERO, Quat.IDENTITY, new Vec2(size.width, size.height));
        updatePositions(this._rectMR, rectData.vertices);

        const worldPos = node.getWorldPosition();
        node.getWorldRotation(tempQuat);

        this._rectNode.setWorldPosition(worldPos);
        this._rectNode.setWorldRotation(tempQuat);
    }
}

export const name = js.getClassName(Canvas);
export const PersistentGizmo = CanvasPersistentGizmo;

registerGizmo(name, { PersistentGizmo });
