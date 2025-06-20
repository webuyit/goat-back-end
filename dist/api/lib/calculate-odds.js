"use strict";
// odds.utils.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOdds = calculateOdds;
const constants_1 = require("./constants");
function calculateOdds(outcomes, virtualStakePerOutcome = 1, maxOdds = constants_1.MAX_ODDS_CAP) {
    // Step 1: Add virtual stake to each outcome
    const outcomesWithVirtual = outcomes.map((o) => (Object.assign(Object.assign({}, o), { effectiveStake: o.totalStaked + virtualStakePerOutcome })));
    // Step 2: Calculate total effective stake
    const totalEffectiveStake = outcomesWithVirtual.reduce((sum, o) => sum + o.effectiveStake, 0);
    // Step 3: Calculate capped odds
    return outcomesWithVirtual.map((o) => {
        const probability = o.effectiveStake / totalEffectiveStake;
        const rawOdds = 1 / probability;
        return Object.assign(Object.assign({}, o), { odds: parseFloat(Math.min(rawOdds, maxOdds).toFixed(2)), impliedProbability: parseFloat((probability * 100).toFixed(1)) });
    });
}
