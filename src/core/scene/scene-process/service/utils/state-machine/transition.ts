import IState from './state-interface';

class Transition<TState extends IState> {
    public fromState: TState;
    public toState: TState;

    public testConditionFunc: Function | null;

    constructor(from: TState, to: TState, testConditionFunc: Function | null = null) {
        this.fromState = from;
        this.toState = to;
        this.testConditionFunc = testConditionFunc;
    }

    public async testCondition(opts: any = {}): Promise<boolean> {
        return this.testConditionFunc === null || this.testConditionFunc();
    }

    public async Complete() {
        this.toState.fromState = this.fromState;
    }
}

class DefaultStateTransition<TState extends IState> extends Transition<TState> {
    constructor(from: TState, to: TState, testConditionFunc: Function | null = null) {
        super(from, to, testConditionFunc);
    }
}

export { Transition, DefaultStateTransition };
