'use strict';

import ControllerBase from '../controller/base';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import { Node, Vec3, Color, Vec2 } from 'cc';

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

const axisDirMap = ControllerUtils.axisDirectionMap;

const tempVec3_a = new Vec3();

let _controller: ScaleController | null = null;

class ScaleController extends ControllerBase {
    private _deltaScale: Vec3 = new Vec3();
    private _scaleFactor = 125;
    static readonly _baseCubeSize = 12.5;
    static readonly _baseAxisLength = 70;
    static readonly scale2D = new Vec3(2, 2, 2);
    static readonly scale3D = new Vec3(1, 1, 1);
    private _axisSliderNodes: any = {};
    private _mouseDeltaPos: Vec2 = new Vec2();
    private _cubeDragValue = 0;
    private _moveAxisName = '';
    private _axisDirMap: { [key: string]: Vec3 } = {};

    public get scaleFactor() {
        return this._scaleFactor;
    }

    public get moveAxisName() {
        return this._moveAxisName;
    }

    constructor(rootNode: Node) {
        super(rootNode);
        this._lockSize = true;
        this._axisDirMap['x'] = axisDirMap['x'].clone();
        this._axisDirMap['y'] = axisDirMap['y'].clone();
        this._axisDirMap['z'] = axisDirMap['z'].clone();
        this._axisDirMap['xyz'] = new Vec3(1, 1, 1); // only for scale
        this.initShape();
        this.onDimensionChanged();
    }

    static getInstance(rootNode: Node): ScaleController {
        if (!_controller) {
            _controller = new ScaleController(rootNode);
        }
        return _controller;
    }

    public onCameraFovChanged = (fov: number) => {
        if (this.transformToolData?.is2D) {
            return;
        }
        const vec = Vec3.multiplyScalar(tempVec3_a, ScaleController.scale3D, fov / 45);
        this.setScale(vec);
    };

    onDimensionChanged() {
        super.onDimensionChanged?.();
        const is2D = this.transformToolData?.is2D ?? false;
        this.setScale(is2D ? ScaleController.scale2D : ScaleController.scale3D);
    }

    createAxis(axisName: string, color: Color, rotation: Vec3) {
        const sliderNode = ControllerUtils.scaleSlider(
            ScaleController._baseCubeSize,
            ScaleController._baseAxisLength,
            color,
            { priority: 1000 },
        );
        sliderNode.name = axisName + 'Slider';
        sliderNode.parent = this.shape;
        sliderNode.setRotationFromEuler(rotation);
        const dir = this._axisDirMap[axisName];
        Vec3.multiplyScalar(tempVec3_a, dir, ScaleController._baseCubeSize / 2);
        sliderNode.setPosition(tempVec3_a);
        this.initHandle(sliderNode, axisName);

        const sliderNodeData: any = {};
        sliderNodeData.head = sliderNode.getChildByName('ScaleSliderHead');
        sliderNodeData.body = sliderNode.getChildByName('ScaleSliderBody');
        this._axisSliderNodes[axisName] = sliderNodeData;
    }

    initShape() {
        this.createShapeNode('ScaleController');
        this.registerEvents();

        this._axisSliderNodes = {};

        this.createAxis('x', Color.RED, new Vec3(-90, -90, 0));
        this.createAxis('y', Color.GREEN, new Vec3(0, 0, 0));
        this.createAxis('z', Color.BLUE, new Vec3(90, 0, 90));

        const xyzNode = ControllerUtils.cube(
            ScaleController._baseCubeSize,
            ScaleController._baseCubeSize,
            ScaleController._baseCubeSize,
            Color.GRAY,
            undefined,
            { priority: 1000 },
        );
        xyzNode.name = 'xyzScale';
        xyzNode.parent = this.shape;
        this.initHandle(xyzNode, 'xyz');

        this.shape.active = false;
    }

    public onAxisSliderMove(axisName: string, deltaDist: number) {
        for (let i = 0; i < axisName.length; i++) {
            const singleAxisName = axisName.charAt(i);
            if (singleAxisName === null) {
                return;
            }

            const sliderData = this._axisSliderNodes[singleAxisName];
            if (!sliderData) continue;

            const head = sliderData.head;
            const body = sliderData.body;

            const newLength = ScaleController._baseAxisLength + deltaDist;
            const scale = newLength / ScaleController._baseAxisLength;

            body?.setScale(scale, 1, 1);
            head?.setPosition(0, newLength, 0);
        }
    }

    getAlignAxisDeltaScale(axisName: string, curMouseDeltaPos: Vec2) {
        const axisDir = this._axisDirMap[axisName];

        const alignAxisMoveDist = this.getAlignAxisMoveDistance(this.localToWorldDir(axisDir), curMouseDeltaPos);

        const deltaScale = new Vec3();
        const deltaDist = alignAxisMoveDist / this._scaleFactor;
        Vec3.multiplyScalar(deltaScale, axisDir, deltaDist);

        this.onAxisSliderMove(axisName, alignAxisMoveDist);

        return deltaScale;
    }

    getAllAxisDeltaScale(axisName: string, moveDelta: Vec2) {
        let moveDist = 0;
        let useYSign = false;
        const absX = Math.abs(moveDelta.x);
        const absY = Math.abs(moveDelta.y);
        const diff = Math.abs(absX - absY) / Math.max(absX, absY);
        if (diff > 0.1) {
            if (absX < absY) {
                useYSign = true;
            }
        }

        const dist = moveDelta.length();
        if (useYSign) {
            moveDist = Math.sign(moveDelta.y) * dist;
        } else {
            moveDist = Math.sign(moveDelta.x) * dist;
        }

        this._cubeDragValue += moveDist;
        const scale = this._cubeDragValue / this._scaleFactor;
        const deltaScale = new Vec3(scale, scale, scale);
        this.onAxisSliderMove(axisName, this._cubeDragValue);

        return deltaScale;
    }

    onMouseDown(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        this._deltaScale.set(0, 0, 0);
        this._mouseDeltaPos.set(0, 0);
        this._cubeDragValue = 0;
        this._moveAxisName = event.handleName;

        this.onAxisSliderMove(event.handleName, 0);

        if (this.onControllerMouseDown) {
            this.onControllerMouseDown(event);
        }
        // CLI: no pointer lock
    }

    onMouseMove(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (this._isMouseDown) {
            this._mouseDeltaPos.x += event.moveDeltaX;
            this._mouseDeltaPos.y += event.moveDeltaY;

            Vec3.set(this._deltaScale, 0, 0, 0);

            if (event.handleName === 'xyz') {
                this._deltaScale = this.getAllAxisDeltaScale(event.handleName, new Vec2(event.moveDeltaX, event.moveDeltaY));
            } else {
                this._deltaScale = this.getAlignAxisDeltaScale(event.handleName, this._mouseDeltaPos);
            }
            if (this.isLock) {
                if (this.onControllerMouseMove) {
                    this.onControllerMouseMove(event);
                }
                return;
            }
            if (this.onControllerMouseMove) {
                this.onControllerMouseMove(event);
            }

            this.updateController();
        }
    }

    onMouseUp(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        this.onAxisSliderMove(this._moveAxisName, 0);

        if (this.onControllerMouseUp) {
            this.onControllerMouseUp(event);
        }
        // CLI: no pointer lock to exit
    }

    onMouseLeave(event: GizmoMouseEvent) {
        this.onMouseUp(event);
    }

    onHoverIn(event: GizmoMouseEvent) {
        this.setHandleColor(event.handleName, Color.YELLOW);
    }

    onHoverOut(event: GizmoMouseEvent<{ hoverInNodeMap: Map<Node, boolean> }>) {
        this.resetHandleColor(event);
    }

    getDeltaScale() {
        return this._deltaScale;
    }

    onShow() {
        this.registerEvents();
        const fov = getService()?.Camera?.getCameraFov?.() ?? 45;
        this.onCameraFovChanged(fov);
        const is2D = this.transformToolData?.is2D ?? false;
        if (is2D) {
            this._handleDataMap.z.topNode.active = false;
            this.updateController();
        } else {
            this._handleDataMap.z.topNode.active = true;
        }
        this.onAxisSliderMove(this._moveAxisName, 0);
    }

    onHide() {
        this.unregisterEvents();
    }
}

export default ScaleController;
