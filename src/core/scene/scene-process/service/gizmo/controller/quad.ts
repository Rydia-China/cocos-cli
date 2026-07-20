import { Node, Color, Quat, Vec3 } from 'cc';

import ControllerBase from './base';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import { setMaterialProperty } from '../utils/engine-utils';

const tempQuat_a = new Quat();

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

class QuadController extends ControllerBase {
    protected _quadNode: Node | null = null;
    private _defaultSize = 1;
    private _size: number = this._defaultSize;
    private _hoverColor: Color = Color.GREEN;

    constructor(rootNode: Node, opts?: any) {
        super(rootNode);

        this.initShape(opts);

        this.registerCameraMovedEvent();
        this._eventsRegistered = true;
    }

    get hoverColor() {
        return this._hoverColor;
    }
    set hoverColor(value) {
        this._hoverColor = value;
    }

    initShape(opts?: any) {
        this.createShapeNode('QuadController');
        let size = this._defaultSize;
        if (opts) {
            if (opts.size) {
                size = opts.size;
            }
        }
        const quadNode = ControllerUtils.quad(new Vec3(), this._defaultSize, this._defaultSize, new Vec3(0, 0, 1), Color.WHITE, opts);
        quadNode.parent = this.shape;
        this._quadNode = quadNode;
        this.updateSize(size);
        this.registerMouseEvents(this._quadNode!, 'quad');
    }

    // mouse events
    onMouseDown(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this.onControllerMouseDown) {
            this.onControllerMouseDown(event);
        }
    }

    onMouseMove(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this.onControllerMouseMove) {
            this.onControllerMouseMove(event);
        }
    }

    onMouseUp(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this.onControllerMouseUp) {
            this.onControllerMouseUp(event);
        }
    }

    onHoverIn(event: GizmoMouseEvent) {}

    onHoverOut(/* event */) {}

    onEditorCameraMoved() {
        // face ctrl to camera
        const editorCamera = getEditorCamera();
        if (editorCamera?.node) {
            const cameraRot = tempQuat_a;
            editorCamera.node.getWorldRotation(cameraRot);
            this._quadNode!.setWorldRotation(cameraRot);
        }
    }

    onShow() {
        if (!this._eventsRegistered) {
            this.registerCameraMovedEvent();
            this._eventsRegistered = true;
        }

        this.onEditorCameraMoved();
    }

    onHide() {
        if (this._eventsRegistered) {
            this.unregisterCameraMoveEvent();
            this._eventsRegistered = false;
        }
    }

    updateSize(size: number) {
        const scale = size / this._defaultSize;
        this._size = size;
        this._quadNode!.setScale(new Vec3(scale, scale, scale));
    }

    setMaterialProperty(name: string, value: any) {
        setMaterialProperty(this._quadNode!, name, value);
    }
}

export default QuadController;
