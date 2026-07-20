import { Camera, Color, gfx, Layers, Rect, renderer } from 'cc';
import { Service } from '../core/decorator';

const CAMERA_EDITOR_GIZMO_MASK = Layers.Enum.GIZMOS | Layers.Enum.IGNORE_RAYCAST;

export default class EditorCameraComponent extends Camera {
    private _uiEditorGizmoCamera: renderer.scene.Camera | null = null;

    set projection(val: number) {
        super.projection = val;
        if (this._uiEditorGizmoCamera) {
            this._uiEditorGizmoCamera.projectionType = val;
        }
    }

    get projection() {
        return super.projection;
    }

    set fov(val: number) {
        super.fov = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.fov = this._camera.fov;
        }
    }

    get fov() {
        return super.fov;
    }

    set orthoHeight(val: number) {
        super.orthoHeight = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.orthoHeight = this._camera.orthoHeight;
        }
    }

    get orthoHeight() {
        return super.orthoHeight;
    }

    set near(val: number) {
        super.near = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.nearClip = this._camera.nearClip;
        }
    }

    get near() {
        return super.near;
    }

    set far(val: number) {
        super.far = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.farClip = this._camera.farClip;
        }
    }

    get far() {
        return super.far;
    }

    set clearColor(val: Color) {
        super.clearColor = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.clearColor = this._camera.clearColor;
        }
    }

    get clearColor() {
        return super.clearColor;
    }

    set clearDepth(val: number) {
        super.clearDepth = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.clearDepth = this._camera.clearDepth;
        }
    }

    get clearDepth() {
        return super.clearDepth;
    }

    set clearStencil(val: number) {
        super.clearStencil = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.clearStencil = this._camera.clearStencil;
        }
    }

    get clearStencil() {
        return super.clearStencil;
    }

    set clearFlags(val: gfx.ClearFlags) {
        super.clearFlags = val;
        // UIEditorGizmoCamera 必须始终保持 NONE，在原始编辑器中 onLoad 延迟调用，
        // setter 执行时 _uiEditorGizmoCamera 为 null 所以不会被同步；
        // CLI 中 onLoad 立即调用，需要手动恢复为 NONE
        if (this._uiEditorGizmoCamera) {
            this._uiEditorGizmoCamera.clearFlag = gfx.ClearFlagBit.NONE;
        }
    }

    get clearFlags() {
        return super.clearFlags;
    }

    set rect(val: Rect) {
        super.rect = val;
        if (this._uiEditorGizmoCamera) {
            this._uiEditorGizmoCamera.setViewportInOrientedSpace(val);
        }
    }

    get rect(): Rect {
        return super.rect;
    }

    set screenScale(val: number) {
        super.screenScale = val;
        if (this._uiEditorGizmoCamera && this._camera) {
            this._uiEditorGizmoCamera.screenScale = this._camera.screenScale;
        }
    }

    get screenScale(): number {
        return super.screenScale;
    }

    public onLoad() {
        super.onLoad();
        this._inEditorMode = true;
        this.camera?.initGeometryRenderer();
        const gr = (Service.Engine as any)?.getGeometryRenderer?.();
        if (gr && this.camera?.geometryRenderer) {
            gr.renderer = this.camera.geometryRenderer;
        }
    }

    public onEnable() {
        super.onEnable();
        const renderScene = this._getRenderScene();
        if (this._uiEditorGizmoCamera) {
            renderScene.addCamera(this._uiEditorGizmoCamera);
            this._uiEditorGizmoCamera.enabled = true;
        }
    }

    public onDisable() {
        super.onDisable();
        if (this._uiEditorGizmoCamera && this._uiEditorGizmoCamera.scene) {
            this._uiEditorGizmoCamera.scene.removeCamera(this._uiEditorGizmoCamera);
        }
    }

    public onDestroy() {
        super.onDestroy();
        if (this._uiEditorGizmoCamera) {
            this._uiEditorGizmoCamera.detachCamera();
            this._uiEditorGizmoCamera = null;
        }
    }

    public _createCamera() {
        const priorCamera = this._camera;
        super._createCamera();
        if (this._camera !== priorCamera && this._camera) {
            this._camera.cameraUsage = renderer.scene.CameraUsage.SCENE_VIEW;
            if (this._uiEditorGizmoCamera) {
                this._uiEditorGizmoCamera.detachCamera();
                this._uiEditorGizmoCamera = null;
            }
            this._uiEditorGizmoCamera = cc.director.root.createCamera();
            if (this._uiEditorGizmoCamera) {
                this._uiEditorGizmoCamera.initialize({
                    name: 'Editor UIGizmoCamera',
                    node: this._camera.node,
                    projection: this.projection,
                    window: cc.director.root.mainWindow,
                    priority: this._priority + 2,
                    usage: renderer.scene.CameraUsage.EDITOR,
                });
                this._uiEditorGizmoCamera.enabled = true;
                this._uiEditorGizmoCamera.visibility = CAMERA_EDITOR_GIZMO_MASK;
                this._uiEditorGizmoCamera.setViewportInOrientedSpace(this._camera.viewport);
                this._uiEditorGizmoCamera.fov = this._camera.fov;
                this._uiEditorGizmoCamera.nearClip = this._camera.nearClip;
                this._uiEditorGizmoCamera.farClip = this._camera.farClip;
                const clrColor = this._camera.clearColor;
                this._uiEditorGizmoCamera.clearColor = new Color(clrColor.x, clrColor.y, clrColor.z, 0);
                this._uiEditorGizmoCamera.clearDepth = this._camera.clearDepth;
                this._uiEditorGizmoCamera.clearStencil = this._camera.clearStencil;
                this._uiEditorGizmoCamera.clearFlag = gfx.ClearFlagBit.NONE;
            }
        }
    }
}
