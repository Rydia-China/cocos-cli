import IState from './state-interface';
import { Transition, DefaultStateTransition } from './transition';
class FiniteStateMachine<TState extends IState> {
    public currentState!: TState;
    private _states: TState[];
    private _transitions: Map<TState, Map<string, Transition<TState>>>;

    constructor(states: TState[]) {
        if (states.length < 1) {
            console.error('A FiniteStateMachine needs at least 1 state');
        }

        this._transitions = new Map<TState, Map<string, Transition<TState>>>();
        this._states = states;

        states.forEach((state) => {
            this._transitions.set(state, new Map<string, Transition<TState>>());
        });
    }

    public addTransition(from: TState, to: TState, command: string, transition?: Transition<TState>): FiniteStateMachine<TState>;
    public addTransition(from: TState, to: TState, command: string, condition: Function): FiniteStateMachine<TState>;
    public addTransition(from: TState, to: TState, command: string, condition: any): any {
        if (!this._states.includes(from)) {
            console.error('unknown from state');
            return this;
        }

        if (!this._states.includes(to)) {
            console.error('unknown to state');
            return this;
        }

        if (typeof condition === 'function') {
            this._transitions.get(from)?.set(command, new DefaultStateTransition<TState>(from, to, condition));
        } else {
            this._transitions.get(from)?.set(command, condition ?? new DefaultStateTransition<TState>(from, to));
        }

        return this;
    }

    public Begin(firstState: TState) {
        if (!firstState) {
            return this;
        }

        if (!this._states.includes(firstState)) {
            console.error('unknown first state');
            return this;
        }

        this.currentState = firstState;
        return this;
    }

    public async issueCommand(command: string, opts: any = {}): Promise<boolean> {
        const transitionsForCurState = this._transitions.get(this.currentState);
        if (transitionsForCurState?.has(command)) {
            const transition = transitionsForCurState.get(command);
            if (!transition) {
                return false;
            }

            if (await transition.testCondition(opts)) {
                await transition.Complete();
                await this.currentState.exit();
                this.currentState = transition.toState;
                await this.currentState.enter(opts);
                return true;
            }
        }

        return false;
    }
}

export default FiniteStateMachine;
