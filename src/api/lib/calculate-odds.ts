// odds.utils.ts

import { CONSTANT_VIRTUAL_STAKE, MAX_ODDS_CAP } from './constants';

type Outcome = {
  id: string;
  label: string;
  totalStaked: number;
};

type OutcomeWithOdds = Outcome & {
  odds: number;
  impliedProbability: number;
};

export function calculateOdds(
  outcomes: Outcome[],
  virtualStakePerOutcome: number = CONSTANT_VIRTUAL_STAKE,
  maxOdds: number = MAX_ODDS_CAP,
): OutcomeWithOdds[] {
  // Step 1: Add virtual stake to each outcome
  const outcomesWithVirtual = outcomes.map((o) => ({
    ...o,
    effectiveStake: o.totalStaked + virtualStakePerOutcome,
  }));

  // Step 2: Calculate total effective stake
  const totalEffectiveStake = outcomesWithVirtual.reduce(
    (sum, o) => sum + o.effectiveStake,
    0,
  );

  // Step 3: Calculate capped odds
  return outcomesWithVirtual.map((o) => {
    const probability = o.effectiveStake / totalEffectiveStake;
    const rawOdds = 1 / probability;
    return {
      ...o,
      odds: parseFloat(Math.min(rawOdds, maxOdds).toFixed(2)), // ⚠️ cap here
      impliedProbability: parseFloat((probability * 100).toFixed(1)),
    };
  });
}

export function calculateOdds2(
  outcomes: Outcome[],
  virtualStakePerOutcome: number = CONSTANT_VIRTUAL_STAKE, // acts like "pre-filled" pool
  maxOdds: number = MAX_ODDS_CAP,
): OutcomeWithOdds[] {
  // Step 1: Build effective stake (real + virtual)
  const outcomesWithEffectiveStake = outcomes.map((o) => ({
    ...o,
    effectiveStake: o.totalStaked + virtualStakePerOutcome,
  }));

  // Step 2: Calculate total effective pool
  const totalEffectiveStake = outcomesWithEffectiveStake.reduce(
    (sum, o) => sum + o.effectiveStake,
    0,
  );

  // Step 3: Calculate odds and implied probability
  return outcomesWithEffectiveStake.map((o) => {
    const probability = o.effectiveStake / totalEffectiveStake;
    const rawOdds = 1 / probability;
    return {
      ...o,
      odds: parseFloat(Math.min(rawOdds, maxOdds).toFixed(2)),
      impliedProbability: parseFloat((probability * 100).toFixed(1)),
    };
  });
}

export function calculateOddsWithUserStake(
  outcomes: Outcome[],
  selectedOutcomeId: string,
  userStake: number,
  virtualStakePerOutcome = CONSTANT_VIRTUAL_STAKE,
  maxOdds = MAX_ODDS_CAP,
): OutcomeWithOdds[] {
  // Step 1: Add user stake + virtual to selected outcome, virtual only to others
  const outcomesWithEffectiveStake = outcomes.map((o) => ({
    ...o,
    effectiveStake:
      o.id === selectedOutcomeId
        ? o.totalStaked + userStake + virtualStakePerOutcome
        : o.totalStaked + virtualStakePerOutcome,
  }));

  // Step 2: Total effective stake
  const totalStake = outcomesWithEffectiveStake.reduce(
    (sum, o) => sum + o.effectiveStake,
    0,
  );

  // Step 3: Final odds
  return outcomesWithEffectiveStake.map((o) => {
    const prob = o.effectiveStake / totalStake;
    const rawOdds = 1 / prob;
    return {
      ...o,
      odds: parseFloat(Math.min(rawOdds, maxOdds).toFixed(2)),
      impliedProbability: parseFloat((prob * 100).toFixed(1)),
    };
  });
}

export interface OutcomeWithSimulation extends Outcome {
  odds: number;
  impliedProbability: number;
  potentialPayout?: number;
  potentialProfit?: number;
}

export function simulateOddsWithUserStake(
  outcomes: Outcome[],
  selectedOutcomeId: string,
  userStake: number,
  virtualStakePerOutcome = 100,
  maxOdds = 20,
): OutcomeWithSimulation[] {
  const updated = outcomes.map((o) => {
    const isSelected = o.id === selectedOutcomeId;
    const effectiveStake =
      o.totalStaked + virtualStakePerOutcome + (isSelected ? userStake : 0);

    return {
      ...o,
      effectiveStake,
    };
  });

  const totalStake = updated.reduce((sum, o) => sum + o.effectiveStake, 0);

  return updated.map((o) => {
    const prob = o.effectiveStake / totalStake;
    const rawOdds = 1 / prob;
    const odds = parseFloat(Math.min(rawOdds, maxOdds).toFixed(2));
    const impliedProbability = parseFloat((prob * 100).toFixed(1));

    const isSelected = o.id === selectedOutcomeId;

    return {
      ...o,
      odds,
      impliedProbability,
      ...(isSelected && userStake > 0
        ? {
            potentialPayout: parseFloat((userStake * odds).toFixed(2)),
            potentialProfit: parseFloat((userStake * (odds - 1)).toFixed(2)),
          }
        : {}),
    };
  });
}
