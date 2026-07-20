import { Vec3 } from 'cc';

function clamp01(val: number): number {
    return Math.min(1, Math.max(0, val));
}

export class AnimateValueBase<T> {
    _start: T;
    _target: T;
    _speed = 0;
    public defaultSpeed = 2;
    _isAnimating = false;
    _lerpPos = 0;

    constructor(value: Readonly<T>) {
        this._start = value;
        this._target = value;
    }

    public get start() { return this._start; }
    public get target() { return this._target; }

    public set target(value: T) {
        if (value !== this._target) {
            this.startAnimating(value, this.value);
        }
    }

    public get lerpPos() {
        const v = 1 - this._lerpPos;
        return 1 - Math.pow(v, 4);
    }

    public get value() {
        if (this.lerpPos >= 1) {
            return this.target;
        }
        return this.getValue();
    }

    public set value(inValue) {
        this.stopAnimating(inValue);
    }

    public get isAnimating() { return this._isAnimating; }

    protected startAnimating(inStart: T, inTarget: T, animSpeed: number = this.defaultSpeed) {
        this._speed = animSpeed;
        this._start = inStart;
        this._target = inTarget;
        this._isAnimating = true;
        this._lerpPos = 0;
    }

    protected stopAnimating(inValue: T) {
        this._target = inValue;
        this._start = inValue;
        this._lerpPos = 1;
        this._isAnimating = false;
    }

    public update(dt: number) {
        if (!this._isAnimating) return;
        this._lerpPos = clamp01(this._lerpPos + (dt * this._speed));
        if (this.lerpPos >= 1) {
            this._isAnimating = false;
        }
    }

    protected getValue(): T {
        return this._start;
    }
}

export class AnimVec3 extends AnimateValueBase<Vec3> {
    private _value: Vec3 = new Vec3();

    public constructor(value: Readonly<Vec3>) {
        super(value ?? Vec3.ZERO);
    }

    protected getValue(): Vec3 {
        Vec3.lerp(this._value, this.start, this.target, this.lerpPos);
        return this._value;
    }
}
