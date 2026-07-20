import { Component } from 'cc';

/**
 * 用于 Controller 碰撞检测的标记组件
 * 编辑器版本使用 @ccclass 和 @property 装饰器，此处简化为纯 Component 子类
 */
export class ControllerShapeCollider extends Component {
    public isDetectMesh = true; // 是否进行Mesh级别的检测

    public isRender = true; // 是否显示，如果true表示是个纯透明的用于碰撞检测的几何体

    public onLoad() {}
}
