import { Quat, Vec3 } from 'cc';
import IState from '../../utils/state-machine/state-interface';
import { CameraMoveMode } from '../utils';
import type { ISceneMouseEvent, ISceneKeyboardEvent } from '../../operation/types';
import type { CameraController3D } from '../camera-controller-3d';

class ModeBase3D implements IState {
    _cameraCtrl: CameraController3D;
    public modeName: CameraMoveMode;
    public fromState?: IState;
    protected _curRot = new Quat();
    protected _curPos = new Vec3();

    constructor(cameraCtrl: CameraController3D, modeName: CameraMoveMode) {
        this._cameraCtrl = cameraCtrl;
        this.modeName = modeName;
    }

    public async enter(opts?: any) {}
    public async exit() {}

    onMouseDBlDown(event: ISceneMouseEvent): boolean { return true; }
    onMouseDown(event: ISceneMouseEvent): boolean { return true; }
    onMouseMove(event: ISceneMouseEvent): boolean { return true; }
    onMouseUp(event: ISceneMouseEvent): boolean { return true; }
    onMouseWheel(event: ISceneMouseEvent) {}
    onKeyDown(event: ISceneKeyboardEvent) {}
    onKeyUp(event: ISceneKeyboardEvent) {}
    onUpdate(deltaTime: number) {}
}

export default ModeBase3D;
