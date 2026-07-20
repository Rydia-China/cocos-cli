import { Node, Vec3, Color, Quat } from 'cc';

import ControllerBase from './base';
import ControllerUtils from '../utils/controller-utils';
import type { GizmoMouseEvent } from '../utils/defines';
import { create3DNode, setMeshColor } from '../utils/engine-utils';

const tempVec3 = new Vec3();
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

class EditableController extends ControllerBase {
    protected _editable = false; // 是否Controller是可编辑的
    protected _edit = false; // 是否开启Controller的编辑
    protected _editHandlesShape: Node | null = null;
    protected _defaultEditHandleSize = 7;
    protected _hoverColor: Color = Color.GREEN;
    protected _editHandleScales: { [key: string]: number } = {};
    protected _editHandleColor: Color = Color.WHITE;
    protected _editHandleKeys: string[] = []; // 用于不放缩的控制点

    public onInitEditHandles?(): void;

    constructor(rootNode: Node) {
        super(rootNode);

        const editorCamera = getEditorCamera();
        if (editorCamera?.node) {
            editorCamera.node.on(Node.EventType.TRANSFORM_CHANGED, this.onEditorCameraMoved, this);
        }
    }

    get editable() {
        return this._editable;
    }
    set editable(value) {
        this._editable = value;
    }

    get edit() {
        return this._edit;
    }
    set edit(value) {
        if (this._editable) {
            this._edit = value;
            if (this._edit === true) {
                this.initEditHandles();
                this.showEditHandles();
            } else {
                this.hideEditHandles();
            }
        }
    }

    get hoverColor() {
        return this._hoverColor;
    }
    set hoverColor(value) {
        this._hoverColor = value;
    }

    createEditHandleShape() {
        this._editHandlesShape = create3DNode('EditControllerShape');
        this._editHandlesShape.parent = this._rootNode;

        // sync transform
        this._editHandlesShape.setPosition(this.getPosition());
        this._editHandlesShape.setRotation(this.getRotation());

        this.registerEvents();
    }

    setRoot(rootNode: Node) {
        super.setRoot(rootNode);
        if (this._editHandlesShape) {
            this._editHandlesShape.parent = this._rootNode;
        }
    }

    setEditHandlesColor(color: Color) {
        // set edit controller color
        if (this.editable) {
            if (this._editHandlesShape) {
                this._editHandleKeys.forEach((key) => {
                    const handleData = this._handleDataMap[key];
                    if (handleData) {
                        const colors: Color[] = [];
                        handleData.rendererNodes.forEach((node: Node) => {
                            setMeshColor(node, color);
                            colors.push(color);
                        });
                        handleData.oriColors = colors;
                    }
                });
            }
        }

        this._editHandleColor = color;
    }

    showEditHandles() {
        if (this._editHandlesShape) {
            this._editHandlesShape.active = true;
        }
    }

    hideEditHandles() {
        if (this._editHandlesShape) {
            this._editHandlesShape.active = false;
        }
    }

    createEditHandle(handleName: string, color: Color) {
        const ctrlSize = this._defaultEditHandleSize;
        const editHandleNode = ControllerUtils.quad(new Vec3(), ctrlSize, ctrlSize, new Vec3(0, 0, 1), color, { unlit: true, priority: 255 });
        editHandleNode.name = handleName;
        editHandleNode.parent = this._editHandlesShape;
        this._editHandleScales[handleName] = 1;
        const handleData = this.initHandle(editHandleNode, handleName);

        return handleData;
    }

    initEditHandles() {
        if (!this._editHandlesShape) {
            this.createEditHandleShape();

            this._editHandleKeys.forEach((key) => {
                this.createEditHandle(key, this._editHandleColor);
                this._updateEditHandle(key);
            });
            this.onInitEditHandles?.();
        }
    }

    _updateEditHandle(handleName: string) { }

    updateEditHandles() {
        this._editHandleKeys.forEach((key) => {
            this._updateEditHandle(key);
        });
    }

    checkEdit() {
        if (this.editable) {
            this.edit = true;
        } else {
            this.hideEditHandles();
        }
    }

    onHoverIn(event: GizmoMouseEvent) {
        this.setHandleColor(event.handleName, this.hoverColor);
    }

    onHoverOut(event: GizmoMouseEvent<{ hoverInNodeMap: Map<Node, boolean> }>) {
        this.resetHandleColor(event);
    }

    onEditorCameraMoved() {
        this.adjustEditHandlesSize();
    }

    adjustControllerSize() {
        super.adjustControllerSize();
        this.adjustEditHandlesSize();
    }

    adjustEditHandlesSize() {
        if (this.edit) {
            const editorCamera = getEditorCamera();
            this._editHandleKeys.forEach((key) => {
                const handleData = this._handleDataMap[key];
                if (handleData) {
                    const node = handleData.topNode;
                    node.getWorldPosition(tempVec3);
                    const scalar = this.getDistScalar(node);
                    node.getPosition(tempVec3);

                    this._editHandleScales[key] = scalar;
                    node.setWorldScale(scalar, scalar, scalar);

                    // face edit ctrl to camera
                    if (editorCamera?.node) {
                        const cameraRot = tempQuat_a;
                        editorCamera.node.getWorldRotation(cameraRot);
                        node.setWorldRotation(cameraRot);
                    }
                }
            });
        }
    }

    setPosition(value: Readonly<Vec3>) {
        super.setPosition(value);

        if (this._editHandlesShape) {
            this._editHandlesShape.setPosition(value);
        }
    }

    setRotation(value: Readonly<Quat>) {
        super.setRotation(value);
        if (this._editHandlesShape) {
            this._editHandlesShape.setRotation(value);
        }
    }

    onShow() {
        if (this._editHandlesShape) {
            this.registerEvents();
            this._editHandlesShape.active = true;
        }
    }

    onHide() {
        this.unregisterEvents();
        if (this._editHandlesShape) {
            this._editHandlesShape.active = false;
        }
    }
}

export default EditableController;
