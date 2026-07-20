import { Color, Node, Quat, Vec2, Vec3, TransformBit, NodeEventType, Mat4 } from 'cc';

import type { GizmoMouseEvent, IHandleData } from '../utils/defines';
import ControllerUtils from '../utils/controller-utils';
import { ControllerShapeCollider } from '../utils/controller-shape-collider';
import {
    setNodeOpacity,
    create3DNode,
    setMeshColor,
    getModel,
    getMeshColor,
    getNodeOpacity,
    ProjectionType,
    getRaycastResultsByNodes,
} from '../utils/engine-utils';

const tempVec3_a = new Vec3();
const tempVec2_a = new Vec2();

/**
 * 获取 transformToolData（惰性访问避免循环依赖）
 */
function getTransformToolData(): any {
    try {
        const { Service } = require('../../core/decorator');
        return Service.Gizmo?.transformToolData;
    } catch (e) {
        return null;
    }
}

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

class ControllerBase {
    get transformToolData() {
        return getTransformToolData();
    }

    get updated() {
        return this._updated;
    }

    get visible() {
        return this.shape?.active;
    }
    public shape!: Node;
    /** 如果 controller 锁死将不再响应拖拽 */
    public isLock = false;
    // delegate function
    public onControllerMouseDown?(event: GizmoMouseEvent): void;
    public onControllerMouseMove?(event: GizmoMouseEvent): void;
    public onControllerMouseUp?(event: GizmoMouseEvent): void;
    public onControllerHoverIn?(event: GizmoMouseEvent): void;
    public onControllerHoverOut?(event: GizmoMouseEvent): void;
    public get isMouseDown() {
        return this._isMouseDown;
    }
    protected _updated = false;
    protected _scale: Vec3 = new Vec3(1, 1, 1);
    protected _localRot: Quat = new Quat();
    protected _localPos: Vec3 = new Vec3();
    protected _rootNode: Node | null = null;
    protected _baseDist = 600;
    protected _handleDataMap: { [key: string]: IHandleData } = {};
    protected _twoPI = Math.PI * 2;
    protected _halfPI = Math.PI / 2;
    protected _degreeToRadianFactor = Math.PI / 180;
    protected _eventsRegistered = false;
    protected _isMouseDown = false;
    protected _color: Color = Color.WHITE;
    protected _lockSize = false; // 保持视觉上的大小固定

    private _onDimensionChanged: ((...args: any[]) => void) | null = null;
    private _onScale2DChanged: ((...args: any[]) => void) | null = null;
    private _onCameraFovChanged: ((fov: number) => void) | null = null;
    private _onCameraOrthoHeightChanged: ((...args: any[]) => void) | null = null;

    private _mouseDownFuncs: Map<string, Function> = new Map<string, Function>();
    private _mouseMoveFuncs: Map<string, Function> = new Map<string, Function>();
    private _mouseUpFuncs: Map<string, Function> = new Map<string, Function>();
    private _mouseLeaveFuncs: Map<string, Function> = new Map<string, Function>();
    private _hoverInFuncs: Map<string, Function> = new Map<string, Function>();
    private _hoverOutFuncs: Map<string, Function> = new Map<string, Function>();

    constructor(rootNode: Node) {
        this._rootNode = rootNode;
    }

    public set lockSize(value: boolean) {
        this._lockSize = value;
    }

    /**
     * 更改控制器所依附的根节点
     */
    public setRoot(rootNode: Node) {
        this._rootNode = rootNode;
        if (this.shape) {
            this.shape.parent = this._rootNode;
        }
    }

    public getRoot() {
        return this._rootNode;
    }

    public createShapeNode(name: string) {
        this.shape = create3DNode(name);
        this.shape.parent = this._rootNode;
    }

    public registerEvents() {
        if (!this._eventsRegistered) {
            this.registerCameraMovedEvent();
            this.registerOrthoHeightChangedEvent();
            this.registerCameraFovChangedEvent();
            this._onDimensionChanged = this.onDimensionChanged.bind(this);
            this._onScale2DChanged = this.onScale2DChanged.bind(this);

            const ttd = getTransformToolData();
            if (ttd) {
                ttd.addListener('dimension-changed', this._onDimensionChanged);
                ttd.addListener('scale-2d-changed', this._onScale2DChanged);
            }

            this._eventsRegistered = true;
        }
    }

    public unregisterEvents() {
        if (this._eventsRegistered) {
            this.unregisterCameraMoveEvent();
            this.unregisterOrthoHeightChangedEvent();
            this.unregisterCameraFovChangedEvent();

            const ttd = getTransformToolData();
            if (ttd) {
                if (this._onDimensionChanged) {
                    ttd.removeListener('dimension-changed', this._onDimensionChanged);
                }
                if (this._onScale2DChanged) {
                    ttd.removeListener('scale-2d-changed', this._onScale2DChanged);
                }
            }

            this._eventsRegistered = false;
        }
    }

    public registerCameraMovedEvent() {
        const editorCamera = getEditorCamera();
        if (editorCamera?.node) {
            editorCamera.node.on('transform-changed', this.onEditorCameraMoved, this);
        }
    }

    public unregisterCameraMoveEvent() {
        const editorCamera = getEditorCamera();
        if (editorCamera?.node) {
            editorCamera.node.off('transform-changed', this.onEditorCameraMoved, this);
        }
    }

    public registerCameraFovChangedEvent() {
        if (this.onCameraFovChanged) {
            this._onCameraFovChanged ??= this.onCameraFovChanged.bind(this);
            try {
                const { Service } = require('../../core/decorator');
                Service.Camera?.on?.('camera:fov-changed', this._onCameraFovChanged);
            } catch (e) {
                // not ready
            }
        }
    }

    public registerOrthoHeightChangedEvent() {
        this._onCameraOrthoHeightChanged = this.onCameraOrthoHeightChanged.bind(this);
        const ttd = getTransformToolData();
        if (ttd) {
            ttd.addListener('camera-ortho-height-changed', this._onCameraOrthoHeightChanged);
        }
    }

    public unregisterCameraFovChangedEvent() {
        if (this._onCameraFovChanged) {
            try {
                const { Service } = require('../../core/decorator');
                Service.Camera?.off?.('camera:fov-changed', this._onCameraFovChanged);
            } catch (e) {
                // not ready
            }
        }
    }

    public unregisterOrthoHeightChangedEvent() {
        if (this._onCameraOrthoHeightChanged) {
            const ttd = getTransformToolData();
            if (ttd) {
                ttd.removeListener('camera-ortho-height-changed', this._onCameraOrthoHeightChanged);
            }
        }
    }

    public onEditorCameraMoved() {
        this.adjustControllerSize();
    }

    public initHandle(node: Node, handleName: string) {
        const rendererNodes = this.getRendererNodes(node);
        const colors: Color[] = [];
        const opacities: number[] = [];
        rendererNodes.forEach((rNode: Node) => {
            const color = getMeshColor(rNode);
            if (color) {
                colors.push(new Color(color.r, color.g, color.b));
                opacities.push(getNodeOpacity(rNode));
            }
        });
        const handleData: IHandleData = {
            name: handleName,
            topNode: node,
            rendererNodes,
            oriColors: colors,
            oriOpacities: opacities,
            normalTorusNode: null,
            indicatorCircle: null,
            arrowNode: null,
            normalTorusMR: null,
            panPlane: null,
            customData: null,
        };

        const rayDetectNodes = this.getRayDetectNodes(node);
        rayDetectNodes.forEach((rNode: Node) => {
            this.registerMouseEvents(rNode, handleName);
        });

        this._handleDataMap[handleName] = handleData;

        return handleData;
    }

    public removeHandle(handleName: string) {
        if (this._handleDataMap[handleName]) {
            const node = this._handleDataMap[handleName].topNode;
            const rayDetectNodes = this.getRayDetectNodes(node);
            rayDetectNodes.forEach((rNode: Node) => {
                this.unregisterMouseEvent(rNode, handleName);
            });
            delete this._handleDataMap[handleName];
        }
    }

    public setHandleColor(handleName: string, color: Color, opacity?: number) {
        const handleData = this._handleDataMap[handleName];
        const rendererNodes = handleData.rendererNodes;
        if (rendererNodes) {
            rendererNodes.forEach((rNode: Node) => {
                if (opacity === undefined || opacity === null) {
                    opacity = getNodeOpacity(rNode);
                }
                setMeshColor(rNode, color);
                setNodeOpacity(rNode, opacity!);
            });
        }
    }

    public resetHandleColor(event?: GizmoMouseEvent<{ hoverInNodeMap: Map<Node, boolean> }>) {
        if (event) {
            this.resetHandleColorByKey(event.handleName, event.customData?.hoverInNodeMap);
        } else {
            for (const key in this._handleDataMap) {
                this.resetHandleColorByKey(key);
            }
        }
    }

    /**
     * 重置指定 handle 的颜色与透明度
     */
    private resetHandleColorByKey(key: string, hoverInNodeMap?: Map<Node, boolean>) {
        const handleData = this._handleDataMap[key];
        if (!handleData) {
            return;
        }
        const rendererNodes = handleData.rendererNodes;
        const oriColors = handleData.oriColors;
        const oriOpacities = handleData.oriOpacities;

        let nodesInHover = 0;
        for (const node of rendererNodes) {
            if (hoverInNodeMap?.has(node)) {
                nodesInHover++;
                if (nodesInHover > 1) {
                    return;
                }
            }
        }
        // reset color and opacity
        for (let i = 0; i < rendererNodes.length; i++) {
            const node = rendererNodes[i];
            setMeshColor(node, oriColors[i]);
            setNodeOpacity(node, oriOpacities[i]);
        }
    }

    public registerMouseEvents(node: Node, controlName: string) {
        const mouseDown = (event: GizmoMouseEvent) => {
            event.handleName = controlName;
            event.node = node;
            this._updated = false;
            this._isMouseDown = true;
            if (this.onMouseDown) {
                this.onMouseDown(event);
            }
        };
        this._mouseDownFuncs.set(controlName, mouseDown.bind(this));
        node.on('mouseDown', this._mouseDownFuncs.get(controlName) as Function);

        const mouseMove = (event: GizmoMouseEvent) => {
            this._updated = true;
            event.handleName = controlName;
            event.node = node;
            if (this.onMouseMove && (!this.shape || this.shape.active)) {
                this.onMouseMove(event);
            }
            repaintEngine();
        };
        this._mouseMoveFuncs.set(controlName, mouseMove.bind(this));
        node.on('mouseMove', this._mouseMoveFuncs.get(controlName) as Function);

        const mouseUp = ((event: GizmoMouseEvent) => {
            event.handleName = controlName;
            event.node = node;
            if (this.onMouseUp && (!this.shape || this.shape.active)) {
                this.onMouseUp(event);
            }
            this._updated = false;
            this._isMouseDown = false;
        }).bind(this);
        this._mouseUpFuncs.set(controlName, mouseUp);
        node.on('mouseUp', mouseUp);

        // 鼠标移出场景窗口，暂时处理为和mouseup等同
        const mouseLeave = ((event: GizmoMouseEvent) => {
            event.handleName = controlName;
            event.node = node;
            if (this.onMouseLeave) {
                this.onMouseLeave(event);
            }
            this._updated = false;
            this._isMouseDown = false;
        }).bind(this);
        this._mouseLeaveFuncs.set(controlName, mouseLeave);
        node.on('mouseLeave', mouseLeave);

        const hoverIn = ((event: GizmoMouseEvent) => {
            event.handleName = controlName;
            event.node = node;
            if (this.onHoverIn) {
                this.onHoverIn(event);
            }
            repaintEngine();
        }).bind(this);
        this._hoverInFuncs.set(controlName, hoverIn);
        node.on('hoverIn', hoverIn);

        const hoverOut = ((event: GizmoMouseEvent) => {
            event.handleName = controlName;
            event.node = node;
            if (this.onHoverOut) {
                this.onHoverOut(event);
            }
            repaintEngine();
        }).bind(this);
        this._hoverOutFuncs.set(controlName, hoverOut.bind(this));
        node.on('hoverOut', hoverOut);
    }

    public unregisterMouseEvent(node: Node, controlName: string) {
        node.off('mouseDown', this._mouseDownFuncs.get(controlName));
        node.off('mouseMove', this._mouseMoveFuncs.get(controlName));
        node.off('mouseUp', this._mouseUpFuncs.get(controlName));
        node.off('mouseLeave', this._mouseLeaveFuncs.get(controlName));
        node.off('hoverIn', this._hoverInFuncs.get(controlName));
        node.off('hoverOut', this._hoverOutFuncs.get(controlName));
    }

    public setPosition(value: Readonly<Vec3>) {
        this.shape?.setPosition(value);
        this.adjustControllerSize();
    }

    // 返回相对于Root的局部坐标
    public getPosition(out?: Vec3) {
        if (!out) {
            out = new Vec3();
        }
        this.shape?.getPosition(out);
        return out;
    }

    // 返回世界坐标
    public getWorldPosition(out?: Vec3) {
        return this.getWorldPositionForNode(this.shape, out);
    }

    public getWorldPositionForNode(source?: Node | null, out?: Vec3) {
        if (!out) {
            out = new Vec3();
        }
        (source ?? this.shape)?.getWorldPosition(out);
        return out;
    }

    /**
     * 该函数是为了支持 UISkew 效果而加入
     */
    public setWorldMatrix(value: Readonly<Mat4>) {
        // @ts-ignore
        this.shape._mat.set(value);
        // @ts-ignore 禁止自身更新节点的世界变换信息
        this.shape._transformFlags = TransformBit.NONE;
        this.shape.children.forEach((child: Node) => {
            child.invalidateChildren(TransformBit.TRS);
        });
        this.shape.emit(NodeEventType.TRANSFORM_CHANGED, TransformBit.TRS);
    }

    public setRotation(value: Readonly<Quat>) {
        this.shape?.setRotation(value);
        this.adjustControllerSize();
    }

    public getRotation(out?: Quat) {
        if (!out) {
            out = new Quat();
        }
        this.shape?.getRotation(out);
        return out;
    }

    public getScale() {
        return this._scale;
    }
    public setScale(value: Vec3) {
        this._scale = value;
        this.adjustControllerSize();
    }

    public updateController() {
        this.adjustControllerSize();
    }

    public getCameraDistScalar(pos: Vec3) {
        const editorCamera = getEditorCamera();
        if (!editorCamera?.node) return 1;
        const dist = ControllerUtils.getCameraDistanceFactor(pos, editorCamera.node);
        const scalar = dist / this._baseDist;

        return scalar;
    }

    protected getDistScalarInOrtho() {
        const editorCamera = getEditorCamera();
        if (!editorCamera?.node) return 1;
        const dist = ControllerUtils.getCameraDistanceFactor(this.getWorldPosition(tempVec3_a), editorCamera.node);
        const fov = editorCamera.fov;
        const depth_size = Math.tan(((fov / 2) * Math.PI) / 180);
        const baseOrthoHeight = depth_size * dist;

        const scalar = (dist / this._baseDist) * (editorCamera.orthoHeight / baseOrthoHeight);
        return scalar;
    }

    protected isCameraInOrtho() {
        const editorCamera = getEditorCamera();
        return editorCamera?.projection === ProjectionType.ORTHO;
    }

    public getDistScalar(node?: Node) {
        let scalar = 1;
        const ttd = this.transformToolData;

        if (ttd?.is2D) {
            // 这里的 1.5 是根据 transform tool 实际显示的效果来调整的
            scalar = 1.5 / ttd.scale2D;
        } else if (this.isCameraInOrtho()) {
            scalar = this.getDistScalarInOrtho();
        } else {
            scalar = this.getCameraDistScalar(this.getWorldPositionForNode(node, tempVec3_a));
        }

        return scalar;
    }

    public adjustControllerSize() {
        let scalar = 1;
        if (this._lockSize) {
            // 根据和相机的距离，对坐标系进行整体放缩，使得大小相对屏幕固定
            scalar = this.getDistScalar();
        }
        const out = new Vec3(this._scale);
        out.multiplyScalar(scalar);
        this.shape?.setScale(out);
    }

    public needRender(node: Node) {
        const csc: any = node.getComponent(ControllerShapeCollider);
        if (csc && csc.isRender === false) {
            return false;
        }

        return true;
    }

    public getRendererNodes(node: Node): Node[] {
        let renderNodes: Node[] = [];

        if (getModel(node) && this.needRender(node)) {
            renderNodes.push(node);
        }

        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            renderNodes = renderNodes.concat(this.getRendererNodes(child));
        }

        return renderNodes;
    }

    public getRayDetectNodes(node: Node): Node[] {
        let rayDetectNodes: Node[] = [];
        if (getModel(node)) {
            rayDetectNodes.push(node);
        }

        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            rayDetectNodes = rayDetectNodes.concat(this.getRayDetectNodes(child));
        }

        return rayDetectNodes;
    }

    public localToWorldPosition(localPos: Vec3) {
        const worldMatrix = new Mat4();
        const worldPos = new Vec3();
        this.shape?.getWorldMatrix(worldMatrix);

        Vec3.transformMat4(worldPos, localPos, worldMatrix);

        return worldPos;
    }

    public localToWorldDir(localDir: Vec3): Vec3 {
        const worldMatrix = new Mat4();
        const worldDir = new Vec3();
        this.shape?.getWorldMatrix(worldMatrix);

        Vec3.transformMat4Normal(worldDir, localDir, worldMatrix);
        Vec3.normalize(worldDir, worldDir);
        return worldDir;
    }

    public worldPosToScreenPos(worldPos: Vec3): Vec3 {
        const editorCamera = getEditorCamera();
        const screenPos = new Vec3();
        editorCamera?.camera?.worldToScreen(screenPos, worldPos);

        return screenPos;
    }

    public getScreenPos(localPos: Vec3) {
        return this.worldPosToScreenPos(this.localToWorldPosition(localPos));
    }

    public getAlignAxisMoveDistance(axisWorldDir: Vec3, deltaPos: Vec2) {
        const endPos = Vec3.add(tempVec3_a, this.getPosition(), axisWorldDir);
        const dirInScreen = this.worldPosToScreenPos(endPos);
        const oriPosInScreen = this.worldPosToScreenPos(this.getPosition());
        Vec2.subtract(dirInScreen, dirInScreen, oriPosInScreen);
        Vec2.normalize(dirInScreen, dirInScreen);
        const alignAxisMoveDist = Vec2.dot(deltaPos, tempVec2_a.set(dirInScreen.x, dirInScreen.y));
        return alignAxisMoveDist;
    }

    getPositionOnPanPlane(hitPos: Vec3, x: number, y: number, panPlane: Node) {
        const results = getRaycastResultsByNodes([panPlane], x, y, Infinity, false);

        if (results.length > 0) {
            const firstResult = results[0];
            hitPos.set(firstResult.hitPoint);
            return true;
        }

        return false;
    }

    public show() {
        if (this.shape) {
            this.shape.active = true;
        }

        if (this.onShow) {
            this.onShow();
        }
    }

    public hide() {
        if (this.shape) {
            this.shape.active = false;
        }
        this._isMouseDown = false;
        this.isLock = false;
        this.resetHandleColor();
        if (this.onHide) {
            this.onHide();
        }
    }

    public onCameraFovChanged?: (fov: number) => void;

    public onDimensionChanged() {
        if (this.visible) {
            if (this.onShow) {
                this.onShow();
            }
        }
    }

    public onScale2DChanged() {
        if (this.visible) {
            this.adjustControllerSize();
        }
    }

    public onCameraOrthoHeightChanged() {
        if (this.visible) {
            this.adjustControllerSize();
        }
    }

    protected onMouseDown?(event: GizmoMouseEvent): boolean | void;
    protected onMouseMove?(event: GizmoMouseEvent): boolean | void;
    protected onMouseUp?(event: GizmoMouseEvent): boolean | void;
    protected onMouseLeave?(event: GizmoMouseEvent): void;
    protected onHoverIn?(event: GizmoMouseEvent): void;
    protected onHoverOut?(event: GizmoMouseEvent): void;
    protected onShow?(): void;
    protected onHide?(): void;
}

export default ControllerBase;
