import type { ISceneMouseEvent, OperationEvent } from './types';

type ListenerEntry = { listener: Function; priority?: number };

export class OperationManager {
    private _events = new Map<string, (Function | ListenerEntry)[]>();

    addListener(type: OperationEvent, listener: Function, priority?: number): this {
        if (!this._events.has(type)) {
            this._events.set(type, []);
        }
        const events = this._events.get(type)!;
        if (priority === undefined) {
            events.push(listener);
        } else {
            let index = 0;
            for (let i = 0; i < events.length; i++) {
                const entry = events[i];
                if (typeof entry === 'function' || !entry.priority) {
                    index = i;
                    break;
                }
                if (entry.priority < priority) {
                    index = i;
                    break;
                }
                index++;
            }
            events.splice(index, 0, { listener, priority });
        }
        return this;
    }

    removeListener(type: OperationEvent, listener: Function): void {
        const events = this._events.get(type);
        if (!events) return;
        for (let i = 0; i < events.length; i++) {
            const entry = events[i];
            const fn = typeof entry === 'function' ? entry : entry.listener;
            if (fn === listener) {
                events.splice(i--, 1);
            }
        }
    }

    emit(type: string, ...args: any[]): void {
        const events = this._events.get(type);
        if (!events) return;
        for (let i = 0; i < events.length; i++) {
            const entry = events[i];
            const fn = typeof entry === 'function' ? entry : entry.listener;
            const result = fn(...args);
            if (result === false) return;
        }
    }

    emitMouseEvent(type: string, event: ISceneMouseEvent, dpr: number = 1): void {
        event.x *= dpr;
        event.y *= dpr;
        event.deltaX *= dpr;
        event.deltaY *= dpr;
        event.wheelDeltaX *= dpr;
        event.wheelDeltaY *= dpr;
        event.moveDeltaX *= dpr;
        event.moveDeltaY *= dpr;
        this.emit(type, event);
    }
}
