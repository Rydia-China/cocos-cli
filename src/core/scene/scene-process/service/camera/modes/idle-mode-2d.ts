import { ModeBase2D } from './mode-base-2d';
import { CameraMoveMode } from '../utils';
import type { CameraController2D } from '../camera-controller-2d';

class IdleMode2D extends ModeBase2D {
    constructor(cameraCtrl: CameraController2D) {
        super(cameraCtrl, CameraMoveMode.IDLE);
    }

    public async enter() {
        this._cameraCtrl.emit('camera-move-mode', CameraMoveMode.IDLE);
    }

    public async exit() {}
}

export { IdleMode2D };
