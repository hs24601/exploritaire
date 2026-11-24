export type CombatActionFlowMode = 'turn_based_pressure' | 'rolling_initiative' | 'real_time_shared';
export type CombatActionSide = 'player' | 'enemy';

export interface CombatActionTicket<TPayload = unknown> {
  id: string;
  sequence: number;
  side: CombatActionSide;
  actorId?: string;
  sourceKey?: string;
  targetKey?: string;
  submittedAtMs: number;
  arrivalAtMs: number;
  payload: TPayload;
}

export interface CombatActionArbiterState<TPayload = unknown> {
  mode: CombatActionFlowMode;
  activeSide: CombatActionSide;
  paused: boolean;
  rollingWindowMs: number;
  rollingDeadlineAtMs: number | null;
  nextSequence: number;
  tickets: CombatActionTicket<TPayload>[];
  reservedSourceKeys: string[];
}

export type CombatActionResolution = 'resolved' | 'interrupted';

export interface ResolvedCombatAction<TPayload = unknown> {
  ticket: CombatActionTicket<TPayload>;
  resolution: CombatActionResolution;
}

export interface AdvanceCombatActionArbiterResult<TPayload = unknown> {
  state: CombatActionArbiterState<TPayload>;
  resolved: ResolvedCombatAction<TPayload>[];
  sideChanged: boolean;
}

const defaultRollingWindowMs = 10_000;

const oppositeSide = (side: CombatActionSide): CombatActionSide => (
  side === 'player' ? 'enemy' : 'player'
);

const sortTickets = <TPayload>(tickets: CombatActionTicket<TPayload>[]) => (
  [...tickets].sort((left, right) => (
    left.arrivalAtMs - right.arrivalAtMs
    || left.submittedAtMs - right.submittedAtMs
    || left.sequence - right.sequence
    || left.id.localeCompare(right.id)
  ))
);

export function createCombatActionArbiter<TPayload = unknown>(options: {
  mode?: CombatActionFlowMode;
  activeSide?: CombatActionSide;
  rollingWindowMs?: number;
  nowMs?: number;
} = {}): CombatActionArbiterState<TPayload> {
  const rollingWindowMs = Math.max(1, Math.round(options.rollingWindowMs ?? defaultRollingWindowMs));
  const mode = options.mode ?? 'turn_based_pressure';
  const nowMs = options.nowMs ?? 0;
  return {
    mode,
    activeSide: options.activeSide ?? 'player',
    paused: false,
    rollingWindowMs,
    rollingDeadlineAtMs: mode === 'rolling_initiative' ? nowMs + rollingWindowMs : null,
    nextSequence: 1,
    tickets: [],
    reservedSourceKeys: [],
  };
}

export function setCombatActionArbiterPaused<TPayload>(
  state: CombatActionArbiterState<TPayload>,
  paused: boolean,
): CombatActionArbiterState<TPayload> {
  return state.paused === paused ? state : { ...state, paused };
}

export function setCombatActionArbiterMode<TPayload>(
  state: CombatActionArbiterState<TPayload>,
  mode: CombatActionFlowMode,
  nowMs: number,
): CombatActionArbiterState<TPayload> {
  if (state.mode === mode) return state;
  return {
    ...state,
    mode,
    rollingDeadlineAtMs: mode === 'rolling_initiative'
      ? nowMs + state.rollingWindowMs
      : null,
  };
}

export function queueCombatAction<TPayload>(
  state: CombatActionArbiterState<TPayload>,
  request: Omit<CombatActionTicket<TPayload>, 'sequence'>,
): CombatActionArbiterState<TPayload> | null {
  if (state.paused || request.arrivalAtMs < request.submittedAtMs) return null;
  if (state.mode !== 'real_time_shared' && request.side !== state.activeSide) return null;
  if (request.sourceKey && state.reservedSourceKeys.includes(request.sourceKey)) return null;

  const ticket: CombatActionTicket<TPayload> = { ...request, sequence: state.nextSequence };
  return {
    ...state,
    nextSequence: state.nextSequence + 1,
    tickets: sortTickets([...state.tickets, ticket]),
    reservedSourceKeys: request.sourceKey
      ? [...state.reservedSourceKeys, request.sourceKey]
      : state.reservedSourceKeys,
  };
}

export function advanceCombatActionArbiter<TPayload>(
  state: CombatActionArbiterState<TPayload>,
  nowMs: number,
  resolve: (ticket: CombatActionTicket<TPayload>) => CombatActionResolution,
): AdvanceCombatActionArbiterResult<TPayload> {
  if (state.paused) return { state, resolved: [], sideChanged: false };

  let next = { ...state, tickets: sortTickets(state.tickets) };
  let sideChanged = false;
  const resolved: ResolvedCombatAction<TPayload>[] = [];

  while (true) {
    const first = next.tickets[0];
    const deadline = next.mode === 'rolling_initiative' ? next.rollingDeadlineAtMs : null;

    // A deadline wins only when no submitted card reaches its destination first.
    if (deadline !== null && deadline <= nowMs && (!first || deadline < first.arrivalAtMs)) {
      const expirations = Math.floor((nowMs - deadline) / next.rollingWindowMs) + 1;
      const nextSide = expirations % 2 === 0
        ? next.activeSide
        : oppositeSide(next.activeSide);
      next = {
        ...next,
        activeSide: nextSide,
        rollingDeadlineAtMs: deadline + (expirations * next.rollingWindowMs),
      };
      sideChanged = sideChanged || nextSide !== state.activeSide;
      continue;
    }
    if (!first || first.arrivalAtMs > nowMs) break;

    next = {
      ...next,
      tickets: next.tickets.slice(1),
      reservedSourceKeys: first.sourceKey
        ? next.reservedSourceKeys.filter((key) => key !== first.sourceKey)
        : next.reservedSourceKeys,
    };

    // A ticket can survive in the queue after its side loses initiative. It returns
    // to the source without invoking game resolution, matching interrupted transport.
    const resolution = next.mode !== 'real_time_shared' && first.side !== next.activeSide
      ? 'interrupted'
      : resolve(first);
    resolved.push({ ticket: first, resolution });

    if (resolution === 'resolved' && next.mode === 'rolling_initiative') {
      next = { ...next, rollingDeadlineAtMs: first.arrivalAtMs + next.rollingWindowMs };
    }
  }

  return { state: next, resolved, sideChanged };
}
