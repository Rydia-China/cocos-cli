import { Quat, Vec3 } from 'cc';

const animations: any[] = [];
const frame = 1000 / 60;
let time = 0;

function step(dt: number) {
    if (time === 0 || animations.length === 0) {
        stopAnim();
        return;
    }
    setTimeout(() => {
        const _time = time;
        time = Date.now();
        for (let i = 0; i < animations.length;) {
            const anim = animations[i];
            const remove = anim._step(dt);
            if (remove === false) {
                animations.splice(i, 1);
            } else {
                i++;
            }
        }
        step(time - _time);
    });
}

function startAnim() {
    if (time !== 0) return;
    time = Date.now();
    step(frame);
}

function stopAnim() {
    time = 0;
}

export class PositionAnimation {
    public target: Vec3 = cc.v3();
    public func: Function | null = null;
    public start: Vec3 = new Vec3();
    public end: Vec3 = new Vec3();
    public travel = 0;
    public time = 0;

    constructor(start: Vec3, end: Vec3, time: number) {
        this.start = start;
        this.end = end;
        this.time = time;
    }

    public _step(time: number) {
        this.travel += time;
        const t = Math.min(this.travel / this.time, 1);
        cc.Vec3.lerp(this.target, this.start, this.end, t);
        this.func && this.func(this.target);
        return t < 1;
    }

    public step(func: Function | null) {
        this.func = func;
    }
}

export class RotationAnimation {
    public target: Quat = cc.quat();
    public func: Function | null = null;
    public start = new Quat();
    public end = new Quat();
    public travel = 0;
    public time = 0;

    constructor(start: Quat, end: Quat, time: number) {
        this.start = start;
        this.end = end;
        this.time = time;
    }

    public _step(time: number) {
        this.travel += time;
        const t = Math.min(this.travel / this.time, 1);
        Quat.slerp(this.target, this.start, this.end, t);
        this.func && this.func(this.target);
        return t < 1;
    }

    public step(func: Function | null) {
        this.func = func;
    }
}

export class NumberAnimation {
    public target = 0;
    public func: Function | null = null;
    public start = 0;
    public end = 0;
    public travel = 0;
    public time = 0;

    constructor(start: number, end: number, time: number) {
        this.target = 0;
        this.func = null;
        this.start = start;
        this.end = end;
        this.travel = 0;
        this.time = time;
    }

    public _step(time: number) {
        this.travel += time;
        const t = Math.min(this.travel / this.time, 1);
        this.target = (1 - t) * this.start + t * this.end;
        this.func && this.func(this.target);
        return t < 1;
    }

    public step(func: Function | null) {
        this.func = func;
    }
}

export function tweenPosition(start: Vec3, end: Vec3, time = 300) {
    const anim = new PositionAnimation(start, end, time);
    animations.push(anim);
    startAnim();
    return anim;
}

export function tweenRotation(start: Quat, end: Quat, time: number) {
    const anim = new RotationAnimation(start, end, time);
    animations.push(anim);
    startAnim();
    return anim;
}

export function tweenNumber(start: number, end: number, time: number) {
    const anim = new NumberAnimation(start, end, time);
    animations.push(anim);
    startAnim();
    return anim;
}
