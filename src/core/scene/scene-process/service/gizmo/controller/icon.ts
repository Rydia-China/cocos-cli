import { assetManager, Color, Node, Vec3 } from 'cc';

import QuadController from './quad';
import ControllerUtils from '../utils/controller-utils';
import { setMaterialProperty, setMeshColor, setNodeOpacity } from '../utils/engine-utils';

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

/**
 * 重绘引擎
 */
function repaintEngine(): void {
    try {
        const { Service } = require('../../core/decorator');
        Service.Engine?.repaintInEditMode?.();
    } catch (e) {
        // not ready
    }
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

function LimitLerp(a: number, b: number, t: number, tMin: number, tMax: number) {
    t = clamp((t - tMin) / (tMax - tMin), 0, 1);
    return a * (1 - t) + b * t;
}

const tempVec3_a = new Vec3();
const tempVec3_b = new Vec3();

class IconController extends QuadController {
    // true: 近大远小, false: 不变大小
    private _is3DIcon = false;
    // 是否可见，用于判断 onEditorCameraMoved 是否进行显示跟隐藏操作
    private _visibility = false;

    constructor(rootNode: Node, opts?: any) {
        super(rootNode, opts);
        this.shape!.name = 'IconController';
        this.registerOrthoHeightChangedEvent();
        this._baseDist = 50;
        this._lockSize = true;
    }

    setTexture(texture: any) {
        setMaterialProperty(this._quadNode!, 'mainTexture', texture);
    }

    setTextureByUUID(uuid: string) {
        assetManager.loadAny(uuid, (err: any, img: any) => {
            if (img) {
                this.setTexture(img);
                repaintEngine();
            }
        });
    }

    public setColor(color: Color) {
        setMeshColor(this._quadNode!, color);
    }

    set is3DIcon(value: boolean) {
        this._is3DIcon = value;

        if (!this._is3DIcon) {
            this.resetShapeScale();
        }

        this.onEditorCameraMoved();
    }

    getDistScalar() {
        let scalar = 1;
        if (this.isCameraInOrtho()) {
            scalar = this.getDistScalarInOrtho();
        } else {
            scalar = this.getCameraDistScalar(this.getPosition());
        }
        return scalar;
    }

    resetShapeScale() {
        this.shape!.setScale(Vec3.ONE);
    }

    onShow() {
        if (!this._eventsRegistered) {
            this.registerCameraMovedEvent();
            this.registerOrthoHeightChangedEvent();
            this._eventsRegistered = true;
        }

        this._visibility = true;
        this.onEditorCameraMoved();
    }

    onHide() {
        if (this._eventsRegistered) {
            this.unregisterCameraMoveEvent();
            this.unregisterOrthoHeightChangedEvent();
            this._eventsRegistered = false;
        }
        this._visibility = false;
    }

    onEditorCameraMoved() {
        super.onEditorCameraMoved();

        const editorCamera = getEditorCamera();
        if (!editorCamera?.node) return;

        const cameraPos = tempVec3_a;
        editorCamera.node.getWorldPosition(cameraPos);
        const dist = Vec3.distance(this.getPosition(tempVec3_b), cameraPos);
        // fade
        const opacity = LimitLerp(0, 1, dist, 5, 10) * 255;

        setNodeOpacity(this._quadNode!, opacity);

        if (this._visibility) {
            // 只有当 icon controller 可见的时候再需要进行更新
            this.shape!.active = opacity >= 50;
        }

        this.adjustControllerSize();
    }

    adjustControllerSize() {
        if (!this._is3DIcon) {
            super.adjustControllerSize();
        } else {
            this.resetShapeScale();
        }
    }
}

export default IconController;
