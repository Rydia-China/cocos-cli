'use strict';

import { Color, DirectionalLight, js, Node, Quat, Vec3 } from 'cc';
import GizmoBase from '../../base/gizmo-base';
import IconGizmoBase from '../../base/gizmo-icon';
import ControllerBase from '../../controller/base';
import FrustumController from '../../controller/frustum';
import ControllerUtils from '../../utils/controller-utils';
import { setMeshColor } from '../../utils/engine-utils';
import { registerGizmo } from '../../gizmo-defines';

// ── DirectionLightController ──────────────────────────────────────────────────

class DirectionLightController extends ControllerBase {
    protected _lightDirNode: Node | null = null;

    constructor(rootNode: Node) {
        super(rootNode);
        this.lockSize = true;
        this.initShape();
        this.registerCameraMovedEvent();
    }

    setColor(color: Color) {
        setMeshColor(this._lightDirNode!, color);
        this._color = color;
    }

    initShape() {
        this.createShapeNode('DirectionLightController');
        const lightOriDir = new Vec3(0, 0, -1);
        const lightDirNode = ControllerUtils.arcDirectionLine(
            new Vec3(), lightOriDir, new Vec3(1, 0, 0),
            this._twoPI, 20, 100, 9, this._color,
        );
        lightDirNode.parent = this.shape;
        this._lightDirNode = lightDirNode;
        this.hide();
    }
}

// ── SelectGizmo ───────────────────────────────────────────────────────────────

const tempQuat = new Quat();

class DirectionalLightComponentGizmo extends GizmoBase<DirectionalLight> {
    private _controller!: DirectionLightController;
    private _frustumCtrl!: FrustumController;
    private _lightGizmoColor: Color = new Color(255, 255, 50);

    init() {
        this.createController();
        this._isInitialized = true;
    }

    onShow() {
        this._controller.show();
        this._frustumCtrl.show();
        this.updateControllerData();
    }

    onHide() {
        this._controller.hide();
        this._frustumCtrl.hide();
    }

    createController() {
        const gizmoRoot = this.getGizmoRoot();
        this._controller = new DirectionLightController(gizmoRoot);
        this._controller.setColor(this._lightGizmoColor);
        this._frustumCtrl = new FrustumController(gizmoRoot);
    }

    onControllerMouseDown() {
        if (!this._isInitialized || this.target === null) return;
    }

    onControllerMouseMove() {
        this.updateDataFromController();
    }

    onControllerMouseUp() {}

    updateDataFromController() {
        if (this._controller.updated && this.target) {
            this.onComponentChanged(this.target.node);
        }
    }

    updateControllerTransform() {
        if (this.target === null) return;
        const node = this.target.node;
        const worldRot = tempQuat;
        node.getWorldRotation(worldRot);
        const worldPos = node.getWorldPosition();
        this._controller.setPosition(worldPos);
        this._controller.setRotation(worldRot);
        this._frustumCtrl.setPosition(worldPos);
        this._frustumCtrl.setRotation(worldRot);
    }

    updateControllerData() {
        if (!this._isInitialized || this.target === null) return;
        const directionalLight = this.target;
        if (directionalLight) {
            if (directionalLight.shadowEnabled) {
                this._frustumCtrl.show();
                this._frustumCtrl.updateSize(0, directionalLight.shadowOrthoSize, 1, 1, directionalLight.shadowNear, directionalLight.shadowFar, 0);
            } else {
                this._frustumCtrl.hide();
            }
        } else {
            this._frustumCtrl.hide();
        }
        this.updateControllerTransform();
    }

    onTargetUpdate() {
        this.updateControllerData();
    }

    onNodeChanged() {
        this.updateControllerData();
    }
}

// ── IconGizmo ─────────────────────────────────────────────────────────────────

class DirectionalLightIconGizmo extends IconGizmoBase<DirectionalLight> {
    public disableOnSelected = true;

    createController() {
        super.createController();
        this._controller.setTextureByUUID('9cb543ba-d152-4809-8a44-8e7bd5712123@6c48a');
    }
}

// ── Exports & registration ────────────────────────────────────────────────────

export const name = js.getClassName(DirectionalLight);
export const SelectGizmo = DirectionalLightComponentGizmo;
export const IconGizmo = DirectionalLightIconGizmo;
export const PersistentGizmo = null;

registerGizmo(name, { SelectGizmo, IconGizmo });
