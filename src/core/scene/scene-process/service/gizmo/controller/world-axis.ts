import { Node, Vec3, Camera, Color, Quat, Texture2D, assetManager, Layers, v3 } from 'cc';

import ControllerBase from './base';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import { setNodeOpacity, setMaterialProperty } from '../utils/engine-utils';

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

const axisDirMap = ControllerUtils.axisDirectionMap;
const AxisName = ControllerUtils.AxisName;

const SceneGizmoLayer = Layers.Enum.SCENE_GIZMO;
const ORTHO = Camera.ProjectionType.ORTHO;
const PERSPECTIVE = Camera.ProjectionType.PERSPECTIVE;
const camera_forward = new Vec3(0, 0, -1);
const tempVec3_a = new Vec3();
const tempVec3_b = new Vec3();
const tempQuat_a = new Quat();

class WorldAxisController extends ControllerBase {
    private _defaultSize = 2;
    private _sceneGizmoCamera: Camera;
    private _cameraOffset: Vec3 = new Vec3(0, 0, 40);
    private _viewDist = 40;
    private _textNodeMap: Map<string, Node> = new Map<string, Node>();

    constructor(rootNode: Node, sceneGizmoCamera: Camera) {
        super(rootNode);

        this._sceneGizmoCamera = sceneGizmoCamera;
        this.initShape();
    }

    createAxis(axisName: string, color: Color, rotation: Vec3) {
        const baseArrowHeadHeight = 5;
        const baseArrowHeadRadius = 2;
        const baseArrowBodyHeight = 6;

        const axisNode = ControllerUtils.arrow(baseArrowHeadHeight, baseArrowHeadRadius, baseArrowBodyHeight, color, {
            forwardPipeline: true,
            bodyBBSize: 0,
        });
        axisNode.name = axisName + 'Axis';
        axisNode.children.forEach((node: Node) => {
            node.layer = SceneGizmoLayer;
        });
        axisNode.name = axisName + 'Axis';
        axisNode.parent = this.shape;
        axisNode.eulerAngles = rotation;
        this.initHandle(axisNode, axisName);
    }

    initShape() {
        this.createShapeNode('WorldAxisController');

        // x axis
        this.createAxis('x', Color.RED, v3(0, 0, -90));

        // y axis
        this.createAxis('y', Color.GREEN, v3());

        // z axis
        this.createAxis('z', Color.BLUE, v3(90, 0, 0));

        const darkColor = new Color(230, 230, 230);

        this.createAxis('neg_x', darkColor, v3(0, 0, 90));
        this.createAxis('neg_y', darkColor, v3(0, 0, 180));
        this.createAxis('neg_z', darkColor, v3(-90, 0, 0));

        // center cube
        const cubeSize = 5;
        const centerNode = ControllerUtils.cube(cubeSize, cubeSize, cubeSize, darkColor, undefined, { forwardPipeline: true });
        centerNode.name = 'Center';
        centerNode.parent = this.shape;
        centerNode.layer = SceneGizmoLayer;
        this.initHandle(centerNode, 'center');

        this.createAxisText(AxisName.x, 'ac74fa2b-1f5b-4ff5-a3f0-f127f4483e91@6c48a', Color.RED);
        this.createAxisText(AxisName.y, '7b5313d0-f1aa-4b1b-a3c8-59d523c35301@6c48a', Color.GREEN);
        this.createAxisText(AxisName.z, '389d5fee-e29c-4221-b397-a4934a0a5694@6c48a', Color.BLUE);

        this.registerCameraMovedEvent();
        this.hide();
    }

    setTexture(node: Node, texture: Texture2D | null) {
        setMaterialProperty(node, 'mainTexture', texture);
    }

    setTextureByUUID(node: Node, uuid: string) {
        assetManager.loadAny(uuid, (err: any, img: any) => {
            if (img) {
                this.setTexture(node, img);
                repaintEngine();
            }
        });
    }

    createAxisText(axis: string, uuid: string, color: Color) {
        const axisNode = this._handleDataMap[axis];
        const textNode = ControllerUtils.quad(Vec3.ZERO, 3, 3, Vec3.UNIT_Z, color, { texture: true, needBoundingBox: false });
        this.setTextureByUUID(textNode, uuid);
        textNode.setPosition(0, 12, 0);
        textNode.parent = axisNode.topNode;
        textNode.layer = SceneGizmoLayer;
        this._textNodeMap.set(axis, textNode);
    }

    onMouseUp(event: GizmoMouseEvent) {
        event.propagationStopped = true;
        if (event.handleName === 'center') {
            // 在编辑器中这里会切换 projection
            // 在CLI中暂不实现
            try {
                const { Service } = require('../../core/decorator');
                Service.Camera?.changeProjection?.();
            } catch (e) {
                // not ready
            }
        } else {
            const dir = axisDirMap[event.handleName];
            try {
                const { Service } = require('../../core/decorator');
                Service.Camera?.rotateCameraToDir?.(dir);
            } catch (e) {
                // not ready
            }
        }
    }

    onHoverIn(event: GizmoMouseEvent) {
        if (event.node && event.node.name === 'Center') {
            event.propagationStopped = true;
        }
        this.setHandleColor(event.handleName, Color.YELLOW);
    }

    onHoverOut(event: GizmoMouseEvent<{ hoverInNodeMap: Map<Node, boolean> }>) {
        this.resetHandleColor(event);
    }

    onEditorCameraMoved() {
        const editorCamera = getEditorCamera();
        if (!editorCamera?.node) return;

        const cameraRot = tempQuat_a;
        editorCamera.node.getWorldRotation(cameraRot);

        // face text to camera
        this._textNodeMap.forEach((textNode: Node) => {
            textNode?.setWorldRotation(cameraRot);
        });

        // alpha
        Vec3.transformQuat(tempVec3_a, camera_forward, cameraRot);
        Object.keys(this._handleDataMap).forEach((key) => {
            const axisData = this._handleDataMap[key];
            const dir = axisDirMap[key];
            if (dir) {
                const opacity = LimitLerp(1, 0, Math.abs(Vec3.dot(tempVec3_a, dir)), 0.9, 1.0) * 255;

                const rendererNodes = axisData.rendererNodes;
                if (rendererNodes) {
                    rendererNodes.forEach((node: Node, index: number) => {
                        if (opacity < 10) {
                            node.active = false;
                        } else {
                            node.active = true;
                            setNodeOpacity(node, opacity);
                            axisData.oriOpacities[index] = opacity;
                        }
                    });
                }
            }
        });

        // sync rotation of Editor Camera
        const sceneGizmoCameraNode = this._sceneGizmoCamera.node;

        Vec3.transformQuat(tempVec3_b, this._cameraOffset, cameraRot);
        Vec3.add(tempVec3_b, this.getPosition(), tempVec3_b);
        sceneGizmoCameraNode.setWorldPosition(tempVec3_b);

        Vec3.transformQuat(tempVec3_b, Vec3.UNIT_Y, cameraRot);
        Vec3.normalize(tempVec3_b, tempVec3_b);
        sceneGizmoCameraNode.lookAt(this.getPosition(), tempVec3_b);
    }

    public onCameraProjectionChanged(projection: number) {
        this._sceneGizmoCamera.projection = projection;
        if (projection === PERSPECTIVE) {
            this._sceneGizmoCamera.node.getWorldRotation(tempQuat_a);
            Vec3.transformQuat(tempVec3_a, Vec3.UNIT_Z, tempQuat_a);
            Vec3.normalize(tempVec3_a, tempVec3_a);
            Vec3.multiplyScalar(tempVec3_a, tempVec3_a, this._viewDist);
            Vec3.add(tempVec3_a, this.getPosition(), tempVec3_a);
            this._sceneGizmoCamera.node.setWorldPosition(tempVec3_a);
        } else {
            const fov = this._sceneGizmoCamera.fov;
            const depth_size = Math.tan(((fov / 2) * Math.PI) / 180);
            const newOrthoHeight = depth_size * this._viewDist;
            this._sceneGizmoCamera.orthoHeight = newOrthoHeight;
        }
    }
}

export default WorldAxisController;
