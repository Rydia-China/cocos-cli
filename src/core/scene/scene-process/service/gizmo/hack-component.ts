import { CCObject, Component, Layers, Node, Scene } from 'cc';

/**
 * 判断节点是否是编辑器节点（Gizmo 层或 HideInHierarchy 标记）
 */
function isEditorNode(node: Node): boolean {
    if (node.layer & Layers.Enum.GIZMOS) return true;
    let iterNode: Node | null = node;
    while (iterNode) {
        if (iterNode.objFlags & CCObject.Flags.HideInHierarchy) return true;
        iterNode = iterNode.parent;
    }
    return false;
}

export class _EditorHackSceneComponent_ extends Component {}
export const editorSceneWeakMap: WeakMap<Node, _EditorHackSceneComponent_> = new WeakMap();

export class _EditorHackTransformComponent_ extends Component {}
export const editorTransformWeakMap: WeakMap<Node, _EditorHackTransformComponent_> = new WeakMap();

export function walkNodeComponent(node: Node, callback: (comp: Component) => void) {
    if (!node || isEditorNode(node)) return;
    if (node instanceof Scene) {
        let sceneComp = editorSceneWeakMap.get(node);
        if (!sceneComp) {
            sceneComp = new _EditorHackSceneComponent_();
            sceneComp.node = node;
            editorSceneWeakMap.set(node, sceneComp);
        }
        callback(sceneComp);
    }
    let transComp = editorTransformWeakMap.get(node);
    if (!transComp) {
        transComp = new _EditorHackTransformComponent_();
        transComp.node = node;
        editorTransformWeakMap.set(node, transComp);
    }
    callback(transComp);
    node.components.forEach((component: Component) => {
        callback(component);
    });
}
