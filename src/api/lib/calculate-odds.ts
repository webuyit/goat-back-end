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
}
