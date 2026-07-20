import ModeBase3D from './mode-base-3d';
import { CameraMoveMode } from '../utils';
import type { CameraController3D } from '../camera-controller-3d';

class IdleMode extends ModeBase3D {
    constructor(cameraCtrl: CameraController3D) {
        super(cameraCtrl, CameraMoveMode.IDLE);
    }

    public async enter() {
        this._cameraCtrl.emit('camera-move-mode', CameraMoveMode.IDLE);
    }

    public async exit() {}
}

export default IdleMode;
