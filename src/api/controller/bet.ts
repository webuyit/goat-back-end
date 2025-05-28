import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { calculateOdds } from '../lib/calculate-odds';

/*export const placeBet = expressAsyncHandler(async (req, res) => {
  const { userId, outcomeId, amount } = req.body;

  if (!userId || !outcomeId || !amount || amount <= 0) {
    res.status(400).json({ message: 'Invalid bet input.' });
  }

  // Fetch user and outcome in parallel
  const [user, outcome] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.outcome.findUnique({
      where: { id: outcomeId },
      include: { market: true },
    }),
  ]);

  if (!user) res.status(404).json({ message: 'User not found.' });
  if (user.points < amount)
    res.status(400).json({ message: 'Insufficient balance.' });

  if (!outcome) res.status(404).json({ message: 'Outcome not found.' });
  if (outcome.market.status !== 'OPEN') {
    res.status(400).json({ message: 'Market is not open for betting.' });
  }

  // Get all outcomes in this market to calculate odds *before* placing bet
  const allOutcomes = await prisma.outcome.findMany({
    where: { marketId: outcome.marketId },
  });

  // Calculate odds with current pools + optional virtual stake if needed
  const oddsArray = calculateOdds(allOutcomes);
  const selectedOdds = oddsArray.find((o) => o.id === outcomeId);
  const oddsAtBet = selectedOdds?.odds ?? 1; // fallback odds if not found

  let placedBet;

  await prisma.$transaction(async (tx) => {
    const existingBet = await tx.bet.findFirst({
      where: { userId, outcomeId },
    });

    // Deduct user points
    await tx.user.update({
      where: { id: userId },
      data: { points: { decrement: amount } },
    });

    // Create bet with odds & potential payout
    placedBet = await tx.bet.create({
      data: {
        userId,
        outcomeId,
        amount,
        oddsAtBet,
        potentialPayout: Math.floor(amount * oddsAtBet), // round down for safety
        status: 'PENDING',
      },
    });

    // Update outcome pool and bettors count if first bet on this outcome by user
    await tx.outcome.update({
      where: { id: outcomeId },
      data: {
        totalStaked: { increment: amount },
        bettorsCount: existingBet ? undefined : { increment: 1 },
      },
    });

    // Log transaction (optional)
    await tx.transaction.create({
      data: {
        userId,
        amount,
        type: 'BET_PLACED',
        transactionId: placedBet.id,
      },
    });
  });

  res.status(201).json({
    message: 'Bet placed successfully.',
    bet: placedBet,
    odds: oddsAtBet,
    impliedProbability: selectedOdds?.impliedProbability ?? null,
  });
});
*/

export const placeBet2 = expressAsyncHandler(async (req, res) => {
  const { userId, outcomeId, amount } = req.body;

  if (!userId || !outcomeId || !amount || amount <= 0) {
    res.status(400).json({ message: 'Invalid bet input.' });
  }

  const [user, outcome] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.outcome.findUnique({
      where: { id: outcomeId },
      include: { market: true },
    }),
  ]);

  if (!user) res.status(404).json({ message: 'User not found.' });
  if (!outcome) res.status(404).json({ message: 'Outcome not found.' });
  if (user.points < amount)
    res.status(400).json({ message: 'Insufficient balance.' });
  if (outcome.market.status !== 'OPEN') {
    res.status(400).json({ message: 'Market is not open for betting.' });
  }

  const allOutcomes = await prisma.outcome.findMany({
    where: { marketId: outcome.marketId },
  });

  const oddsArray = calculateOdds(allOutcomes);
  const selectedOdds = oddsArray.find((o) => o.id === outcomeId);
  const oddsAtBet = selectedOdds?.odds ?? 1;

  let placedBet;

  await prisma.$transaction(async (tx) => {
    const existingBet = await tx.bet.findFirst({
      where: { userId, outcomeId },
    });

    // Deduct user points
    await tx.user.update({
      where: { id: userId },
      data: { points: { decrement: amount } },
    });

    // Create the bet
    placedBet = await tx.bet.create({
      data: {
        userId,
        outcomeId,
        amount,
        oddsAtBet,
        potentialPayout: Math.floor(amount * oddsAtBet),
        status: 'PENDING',
      },
    });

    // Update outcome pool
    await tx.outcome.update({
      where: { id: outcomeId },
      data: {
        totalStaked: { increment: amount },
        bettorsCount: existingBet ? undefined : { increment: 1 },
      },
    });

    // Log transaction
    await tx.transaction.create({
      data: {
        userId,
        amount,
        type: 'BET_PLACED',
        transactionId: placedBet.id,
      },
    });

    // ===== Start: Referral + Sponsor logic =====
    const FEE_PERCENT = 0.05; // 5% platform fee
    const feeAmount = Math.floor(amount * FEE_PERCENT);
    const isSponsored = outcome.market.marketType === 'SPONSORED';
    const sponsorId = outcome.market.creatorId;

    const [referrerId, userBetCount] = await Promise.all([
      user.referralCode,
      tx.bet.count({ where: { userId } }),
    ]);

    // Sponsored Market
    if (isSponsored) {
      const sponsorShare = Math.floor(feeAmount * 0.3);
      let referralShare = 0;

      if (referrerId && userBetCount < 10) {
        referralShare = Math.floor(feeAmount * 0.1);

        // Pay referral
        await tx.user.update({
          where: { id: referrerId },
          data: { points: { increment: referralShare } },
        });

        await tx.referralEarning.create({
          data: {
            referrerId,
            referredId: userId,
            amountEarned: referralShare,
            source: 'SPONSORED_MARKET',
            betId: placedBet.id,
          },
        });

        await tx.transaction.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL_REWARD',
            transactionId: placedBet.id,
          },
        });
        await tx.notification.create({
          data: {
            userId: referrerId,
            title: 'Rewards',
            type: 'REWARD',
            body: `You earned ${referralShare} points for referring ${user.fullName}.`,
          },
        });
      }

      const finalSponsorShare = sponsorShare - referralShare;
      if (finalSponsorShare > 0) {
        await tx.user.update({
          where: { id: sponsorId },
          data: { points: { increment: finalSponsorShare } },
        });

        await tx.transaction.create({
          data: {
            userId: sponsorId,
            amount: finalSponsorShare,
            type: 'SPONSOR_REWARD',
            transactionId: placedBet.id,
          },
        });
        // Create notification
        await tx.notification.create({
          data: {
            userId: referrerId,
            title: 'Sponsor Rewards',
            type: 'REWARD',
            body: `You earned ${finalSponsorShare} points points as a sponsor on market ${outcome.market.title}.`,
          },
        });
      }
    } else {
      // Un-sponsored market — platform pays referral from its cut
      if (referrerId && userBetCount < 10) {
        const referralShare = Math.floor(feeAmount * 0.1);

        await tx.user.update({
          where: { id: referrerId },
          data: { points: { increment: referralShare } },
        });

        await tx.referralEarning.create({
          data: {
            referrerId,
            referredId: userId,
            amountEarned: referralShare,
            source: 'UNSPONSORED_MARKET',
            betId: placedBet.id,
          },
        });

        await tx.transaction.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL_REWARD',
            transactionId: placedBet.id,
          },
        });

        await tx.notification.create({
          data: {
            userId: referrerId,
            title: 'Rewards',
            type: 'REWARD',
            body: `You earned ${referralShare} points for referring ${user.fullName}.`,
          },
        });
      }
    }
    // ===== End: Referral + Sponsor logic =====
  });

  res.status(201).json({
    message: 'Bet placed successfully.',
    bet: placedBet,
    odds: oddsAtBet,
    impliedProbability: selectedOdds?.impliedProbability ?? null,
  });
});
