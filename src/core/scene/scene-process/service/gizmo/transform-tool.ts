import { IVec3Like, Vec3 } from 'cc';
import { EventEmitter } from 'events';

export interface ISnapConfigData {
    position: IVec3Like;
    rotation: number;
    scale: number;
    isPositionSnapEnabled: boolean;
    isRotationSnapEnabled: boolean;
    isScaleSnapEnabled: boolean;
}

export class SnapConfigs extends EventEmitter {
    private _position: IVec3Like = new Vec3(1, 1, 1);
    private _rotation = 1;
    private _scale = 1;
    private _isPositionSnapEnabled = false;
    private _isRotationSnapEnabled = false;
    private _isScaleSnapEnabled = false;

    get position(): IVec3Like { return this._position; }
    set position(value: IVec3Like) {
        this._position.x = value.x;
        this._position.y = value.y;
        this._position.z = value.z;
        this.emit('snap-position-changed', this._position);
    }

    get rotation(): number { return this._rotation; }
    set rotation(value: number) {
        this._rotation = value;
        this.emit('snap-rotation-changed', this._rotation);
    }

    get scale(): number { return this._scale; }
    set scale(value: number) {
        this._scale = value;
        this.emit('snap-scale-changed', this._scale);
    }

    get isPositionSnapEnabled() { return this._isPositionSnapEnabled; }
    set isPositionSnapEnabled(value) {
        this._isPositionSnapEnabled = value;
        this.emit('enable-snap-position-changed', this._isPositionSnapEnabled);
    }

    get isRotationSnapEnabled() { return this._isRotationSnapEnabled; }
    set isRotationSnapEnabled(value) {
        this._isRotationSnapEnabled = value;
        this.emit('enable-snap-rotation-changed', this._isRotationSnapEnabled);
    }

    get isScaleSnapEnabled() { return this._isScaleSnapEnabled; }
    set isScaleSnapEnabled(value) {
        this._isScaleSnapEnabled = value;
        this.emit('enable-snap-scale-changed', this._isScaleSnapEnabled);
    }

    public getPureDataObject(): ISnapConfigData {
        return {
            position: {
                x: this._position.x,
                y: this._position.y,
                z: this._position.z,
            },
            rotation: this._rotation,
            scale: this._scale,
            isPositionSnapEnabled: this._isPositionSnapEnabled,
            isRotationSnapEnabled: this._isRotationSnapEnabled,
            isScaleSnapEnabled: this._isScaleSnapEnabled,
        };
    }

    public initFromData(data: ISnapConfigData) {
        if (!data) return;
        if (data.position) {
            this._position.x = data.position.x;
            this._position.y = data.position.y;
            this._position.z = data.position.z;
        }
        this._rotation = data.rotation ?? this._rotation;
        this._scale = data.scale ?? this._scale;
        this._isPositionSnapEnabled = data.isPositionSnapEnabled ?? this._isPositionSnapEnabled;
        this._isRotationSnapEnabled = data.isRotationSnapEnabled ?? this._isRotationSnapEnabled;
        this._isScaleSnapEnabled = data.isScaleSnapEnabled ?? this._isScaleSnapEnabled;
    }
}

export type TransformToolDataToolNameType = 'view' | 'position' | 'rotation' | 'scale' | 'rect';
export const transformToolDataToolNameTypeList = ['view', 'position', 'rotation', 'scale', 'rect'];
export type TransformToolDataCoordinateType = 'local' | 'global';
const transformToolDataCoordinateTypeList = ['local', 'global'];
export type TransformToolDataPivotType = 'pivot' | 'center';
const transformToolDataPivotTypeList = ['pivot', 'center'];
export type TransformToolDataViewMode = 'view' | 'select';

export class TransformToolData extends EventEmitter {
    private _toolName: TransformToolDataToolNameType = 'position';
    private _viewMode: TransformToolDataViewMode = 'select';
    private _coordinate: TransformToolDataCoordinateType = 'local';
    private _pivot: TransformToolDataPivotType = 'pivot';
    private _isLocked = false;
    private _is2D = false;
    private _scale2D = 1.0;
    public snapConfigs: SnapConfigs = new SnapConfigs();

    get toolName() { return this._toolName; }
    set toolName(value) {
        if (this._isLocked || !transformToolDataToolNameTypeList.includes(value)) return;
        if (value === 'view') {
            this.viewMode = this._viewMode === 'view' ? 'select' : 'view';
        } else {
            this.viewMode = 'select';
        }
        this._toolName = value;
        this.emit('tool-name-changed', this._toolName);
    }

    get viewMode() { return this._viewMode; }
    set viewMode(value: TransformToolDataViewMode) {
        if (this._isLocked) return;
        this._viewMode = value;
        this.emit('view-mode-changed', this._viewMode);
    }

    get coordinate() { return this._coordinate; }
    set coordinate(value) {
        if (this._isLocked || !transformToolDataCoordinateTypeList.includes(value)) return;
        this._coordinate = value;
        this.emit('coordinate-changed', this._coordinate);
    }

    get pivot() { return this._pivot; }
    set pivot(value) {
        if (this._isLocked || !transformToolDataPivotTypeList.includes(value)) return;
        this._pivot = value;
        this.emit('pivot-changed', this._pivot);
    }

    get isLocked() { return this._isLocked; }
    set isLocked(value) {
        this._isLocked = value;
        this.emit('lock-changed', this._isLocked);
    }

    get is2D() { return this._is2D; }
    set is2D(value) {
        this._is2D = value;
        this.emit('dimension-changed', this._is2D);
    }

    get scale2D() { return this._scale2D; }
    set scale2D(value) {
        this._scale2D = value;
        this.emit('scale-2d-changed', this._scale2D);
    }

    set cameraOrthoHeight(value: number) {
        this.emit('camera-ortho-height-changed', value);
    }
}
