import { Quat, Vec3 } from 'cc';
import IState from '../../utils/state-machine/state-interface';
import { CameraMoveMode } from '../utils';
import type { ISceneMouseEvent, ISceneKeyboardEvent } from '../../operation/types';
import type { CameraController2D } from '../camera-controller-2d';

class ModeBase2D implements IState {
    _cameraCtrl: CameraController2D;
    public modeName: CameraMoveMode;
    public fromState?: IState;
    protected _curRot = new Quat();
    protected _curPos = new Vec3();

    constructor(cameraCtrl: CameraController2D, modeName: CameraMoveMode) {
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

export { ModeBase2D };
