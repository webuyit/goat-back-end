import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { startOfWeek, subDays } from 'date-fns';
import { Prisma, MarketStatus, MarketType } from '@prisma/client';
import { calculateOdds } from '../lib/calculate-odds';

// THESE ARE UN-STABLE METHODS

export const resolveMarket2 = expressAsyncHandler(async (req, res) => {
  const { marketId, winningOutcomeId } = req.body;

  if (!marketId || !winningOutcomeId) {
    res.status(400).json({ message: 'Missing marketId or winningOutcomeId.' });
    return;
  }

  // Fetch market and outcomes (with bets)
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      outcomes: {
        include: { bets: true },
      },
      tournaments: true, // if market belongs to any tournament
    },
  });

  if (!market) {
    res.status(404).json({ message: 'Market not found.' });
    return;
  }

  const allBets = market.outcomes.flatMap((o) => o.bets);

  if (allBets.length === 0) {
    res.status(404).json({ message: 'No bets found for this market.' });
    return;
  }

  const winningOutcome = market.outcomes.find((o) => o.id === winningOutcomeId);
  if (!winningOutcome) {
    res.status(400).json({ message: 'Winning outcome not found.' });
    return;
  }

  const updates = [];
  const participantScores: Record<string, number> = {};
  const notifications = [];

  for (const bet of allBets) {
    const isWinner = bet.outcomeId === winningOutcomeId;

    if (isWinner) {
      const payout = Math.floor(bet.potentialPayout || 0);

      updates.push(
        prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'WON' },
        }),
        prisma.user.update({
          where: { id: bet.userId },
          data: { points: { increment: payout } },
        }),
        prisma.transaction.create({
          data: {
            userId: bet.userId,
            amount: payout,
            type: 'BET_WON',
            transactionId: bet.id,
          },
        }),
      );

      // Track user score if tournament exists
      for (const tournament of market.tournaments) {
        participantScores[`${tournament.id}:${bet.userId}`] =
          (participantScores[`${tournament.id}:${bet.userId}`] || 0) + payout;
      }

      notifications.push({
        userId: bet.userId,
        title: '🎉 You won your bet!',
        body: `You won ${payout} points on your bet.`,
        type: 'BET_RESULT',
        link: `/market/${marketId}`,
      });
    } else {
      updates.push(
        prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'LOST' },
        }),
      );

      notifications.push({
        userId: bet.userId,
        title: '❌ Your bet lost',
        body: `Better luck next time. You lost your bet on this market.`,
        type: 'BET_RESULT',
        link: `/market/${marketId}`,
      });
    }
  }

  // Mark market as resolved
  updates.push(
    prisma.market.update({
      where: { id: marketId },
      data: {
        status: 'RESOLVED',
        winningOutcomeId,
        resolvedAt: new Date(),
      },
    }),
  );

  // Update tournament participant scores
  for (const key in participantScores) {
    const [tournamentId, userId] = key.split(':');
    const score = participantScores[key];

    updates.push(
      prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId,
          userId,
        },
        data: {
          score: {
            increment: score,
          },
        },
      }),
    );
  }

  // Send notifications (outside the transaction)
  await prisma.$transaction(updates);

  await Promise.all(
    notifications.map((n) => prisma.notification.create({ data: n })),
  );

  res.status(200).json({
    message:
      'Market resolved. Bets settled, points updated, and tournament scores tracked.',
  });
});
