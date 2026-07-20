import { Node, Color, Vec3, MeshRenderer, Camera, Layers } from 'cc';

import ControllerBase from './base';
import ControllerUtils from '../utils/controller-utils';
import ControllerShape from '../utils/controller-shape';
import {
    updatePositions,
    updateBoundingBox,
    setMeshColor,
} from '../utils/engine-utils';

/**
 * 获取 Gizmo transformToolData（惰性访问避免循环依赖）
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

interface ISegment {
    start: Vec3;
    end: Vec3;
    color: Color;
}

// 为了防止轴在区域内穿帮
const MARGIN = 50;
// 3D 视图中轴最大长度
const LINE_3D_MAXIMUM_LENGTH = 100000;
// xyz 轴的信息
const axis = {
    x: {
        name: 'x',
        start: new Vec3(0, 0, 0),
        end: new Vec3(0, 0, 0),
        color: Color.RED,
    },
    y: {
        name: 'y',
        start: new Vec3(0, 0, 0),
        end: new Vec3(0, 0, 0),
        color: Color.GREEN,
    },
    z: {
        name: 'z',
        start: new Vec3(0, 0, 0),
        end: new Vec3(0, 0, 0),
        color: Color.BLUE,
    },
};

export default class OriginAxisController extends ControllerBase {
    camera: Camera | null = null;
    xAxis: MeshRenderer | null = null;
    yAxis: MeshRenderer | null = null;
    zAxis: MeshRenderer | null = null;

    static changeCenterAxisVisible(
        controller: OriginAxisController | null,
        originAxis: {
            x_visible: boolean;
            y_visible: boolean;
            z_visible: boolean;
        },
    ) {
        if (!controller) return;

        controller.setVisible(originAxis.x_visible, originAxis.y_visible, originAxis.z_visible);
    }

    constructor(rootNode: Node, camera: Camera) {
        super(rootNode);
        this.camera = camera;
        this.initShape();
    }

    protected onCameraTransformChanged() {
        requestAnimationFrame(() => {
            this.updateTransform();
        });
    }

    protected onShow() {
        if (this.camera) {
            this.camera.node.on('transform-changed', this.onCameraTransformChanged, this);
        }
        this.updateTransform();
    }

    protected onHide() {
        if (this.camera) {
            this.camera.node.off('transform-changed', this.onCameraTransformChanged, this);
        }
    }

    private appEditorLayer(meshRenderer: MeshRenderer | null) {
        if (!meshRenderer) return;

        meshRenderer.node.layer = Layers.Enum.EDITOR | Layers.Enum.IGNORE_RAYCAST;
    }

    private initShape() {
        this.createShapeNode('Origin-Axis');

        this.xAxis = ControllerUtils.createLine(this.shape, axis.x.start, axis.x.end, axis.x.color, { name: axis.x.name });
        this.appEditorLayer(this.xAxis);
        this.yAxis = ControllerUtils.createLine(this.shape, axis.y.start, axis.y.end, axis.y.color, { name: axis.y.name });
        this.appEditorLayer(this.yAxis);
        this.zAxis = ControllerUtils.createLine(this.shape, axis.z.start, axis.z.end, axis.z.color, { name: axis.z.name });
        this.appEditorLayer(this.zAxis);

        this.show();
    }

    public updateAxisLineTransform() {
        if (!this.camera) return;

        const ttd = getTransformToolData();
        if (ttd?.is2D) {
            const cameraPos = this.camera.node.worldPosition;
            const scaleRatio = this.camera.orthoHeight / (typeof window !== 'undefined' ? window.innerHeight : 600);
            const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
            const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
            const xLength = (innerWidth + MARGIN) * scaleRatio;
            const yLength = (innerHeight + MARGIN) * scaleRatio;

            axis.x.start.set(-xLength + cameraPos.x, 0, 0);
            axis.x.end.set(xLength + cameraPos.x, 0, 0);
            axis.y.start.set(0, -yLength + cameraPos.y, 0);
            axis.y.end.set(0, yLength + cameraPos.y, 0);
            // 2D 模式下 z 轴不显示
            axis.z.start.set(0, 0, 0);
            axis.z.end.set(0, 0, 0);
        } else {
            axis.x.start.set(-LINE_3D_MAXIMUM_LENGTH, 0, 0);
            axis.x.end.set(LINE_3D_MAXIMUM_LENGTH, 0, 0);
            axis.y.start.set(0, -LINE_3D_MAXIMUM_LENGTH, 0);
            axis.y.end.set(0, LINE_3D_MAXIMUM_LENGTH, 0);
            axis.z.start.set(0, 0, -LINE_3D_MAXIMUM_LENGTH);
            axis.z.end.set(0, 0, LINE_3D_MAXIMUM_LENGTH);
        }

        this.updateLineTransform(this.xAxis, axis.x.start, axis.x.end);
        this.updateLineTransform(this.yAxis, axis.y.start, axis.y.end);
        this.updateLineTransform(this.zAxis, axis.z.start, axis.z.end);
        repaintEngine();
    }

    protected updateLineTransform(target: MeshRenderer | null, start: Vec3, end: Vec3) {
        if (!target) return;

        const lineData = ControllerShape.calcLineData(start, end);
        updatePositions(target, lineData.positions);
        updateBoundingBox(target, lineData.minPos, lineData.maxPos);
    }

    public onDimensionChanged() {
        super.onDimensionChanged();
        this.updateTransform();
    }

    public setColor(colors: Color[]) {
        this.xAxis && setMeshColor(this.xAxis.node, colors[0]);
        this.yAxis && setMeshColor(this.yAxis.node, colors[1]);
        this.zAxis && setMeshColor(this.zAxis.node, colors[2]);
    }

    // 转为指定节点坐标系下
    public updateTransform(targetNode?: Node | null) {
        const parent = this.xAxis && this.xAxis.node.parent;
        if (parent && targetNode) {
            parent.setWorldPosition(targetNode.worldPosition);
        }

        this.updateAxisLineTransform();
    }

    // originAxis = [x,y,z]
    public setVisible(xAxisVisible: boolean, yAxisVisible: boolean, zAxisVisible: boolean) {
        this.xAxis && (this.xAxis.node.active = xAxisVisible);
        this.yAxis && (this.yAxis.node.active = yAxisVisible);
        this.zAxis && (this.zAxis.node.active = zAxisVisible);
        this.updateAxisLineTransform();
        repaintEngine();
    }
}
