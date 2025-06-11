// odds.utils.ts

import { MAX_ODDS_CAP } from './constants';

/*import { MAX_ODDS_CAP } from "./constants";

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
  virtualStakePerOutcome: number = 1,
   maxOdds: number = MAX_ODDS_CAP, 
): OutcomeWithOdds[] {
  // Add virtual stake to each outcome
  const outcomesWithVirtual = outcomes.map((o) => ({
    ...o,
    effectiveStake: o.totalStaked + virtualStakePerOutcome,
  }));

  const totalEffectiveStake = outcomesWithVirtual.reduce(
    (sum, o) => sum + o.effectiveStake,
    0,
  );

  // Now compute odds and implied probability
  return outcomesWithVirtual.map((o) => {
    const probability = o.effectiveStake / totalEffectiveStake;
    return {
      ...o,
      odds: parseFloat((1 / probability).toFixed(2)), // rounded to 2 decimals
      impliedProbability: parseFloat((probability * 100).toFixed(1)), // %
    };
  });
}*/

// odds.utils.ts

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
  virtualStakePerOutcome: number = 1,
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
