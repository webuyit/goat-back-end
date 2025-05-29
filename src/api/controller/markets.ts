import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { startOfWeek, subDays } from 'date-fns';
import { Prisma, MarketStatus, MarketType } from '@prisma/client';
export const createSponsoredMarket = expressAsyncHandler(async (req, res) => {
  const {
    title,
    outcomes,
    stakeAmount,
    userId,
    playerIds,
    endsAt,
    startsAt,
    coverUrl,
    themeColor,
  } = req.body;

  if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
    res.status(400).json({
      message:
        'Invalid market data. Title and at least 2 outcomes are required.',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.points < stakeAmount) {
    res
      .status(400)
      .json({ message: 'Insufficient balance to sponsor market.' });
  }

  let createdMarket;

  // Perform all DB operations in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Deduct the user's points (lock stake)
    await tx.user.update({
      where: { id: userId },
      data: {
        points: {
          decrement: stakeAmount,
        },
      },
    });

    // 2. Create the market and associated outcomes
    createdMarket = await tx.market.create({
      data: {
        title,
        status: 'OPEN',
        sponsoredStake: stakeAmount,
        marketType: 'SPONSORED',
        endsAt,
        startsAt,
        creatorId: userId,
        coverUrl,
        themeColor,
        outcomes: {
          create: outcomes.map((label) => ({ label })),
        },
        players: {
          create: playerIds.map((playerId) => ({
            player: { connect: { id: playerId } },
          })),
        },
      },
    });

    // 3. Record the transaction
    await tx.transaction.create({
      data: {
        user: { connect: { id: userId } },
        amount: stakeAmount,
        type: 'MARKET_CREATED',
        transactionId: createdMarket.id,
      },
    });
  });

  // Respond AFTER the transaction completes
  res.status(201).json({
    message: 'Market created successfully.',
    marketId: createdMarket.id,
  });
});

export const createInHouseMarket = expressAsyncHandler(async (req, res) => {
  const {
    title,
    outcomes,
    userId,
    playerIds,
    startsAt,
    endsAt,
    coverUrl,
    themeColor,
  } = req.body;

  if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
    res.status(400).json({
      message:
        'Invalid market data. Title and at least 2 outcomes are required.',
    });
  }

  // Optional: validate user exists (e.g., admin or internal system)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
  }

  // Create the market (no stake deducted)
  const market = await prisma.market.create({
    data: {
      title,
      status: 'OPEN',
      marketType: 'FRIENDLY', // you can define this in your enum
      creatorId: userId,
      startsAt,
      endsAt,
      coverUrl,
      themeColor,
      outcomes: {
        create: outcomes.map((label) => ({ label })),
      },
      players: {
        create: playerIds.map((playerId) => ({
          player: { connect: { id: playerId } },
        })),
      },
    },
  });

  res.status(201).json({
    message: 'In-house market created successfully.',
    marketId: market.id,
  });
});

export const resolveMarket = expressAsyncHandler(async (req, res) => {
  const { marketId, winningOutcomeId } = req.body;

  if (!marketId || !winningOutcomeId) {
    res.status(400).json({ message: 'Missing marketId or winningOutcomeId.' });
  }

  try {
    // Fetch market + outcomes + all bets
    const outcomes = await prisma.outcome.findMany({
      where: { marketId },
      include: { bets: true },
    });

    const allBets = outcomes.flatMap((o) => o.bets);

    if (allBets.length === 0) {
      res.status(404).json({ message: 'No bets found for this market.' });
    }

    const winningOutcome = outcomes.find((o) => o.id === winningOutcomeId);
    if (!winningOutcome) {
      res.status(400).json({ message: 'Winning outcome not found.' });
    }

    const updates = [];

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
          prisma.notification.create({
            data: {
              userId: bet.userId,
              title: '🎉 You won your bet!',
              body: `You won ${payout} points on your bet.`,
              type: 'BET_RESULT',
              link: `/market/${marketId}`,
            },
          }),
        );
      } else {
        updates.push(
          prisma.bet.update({
            where: { id: bet.id },
            data: { status: 'LOST' },
          }),
          prisma.notification.create({
            data: {
              userId: bet.userId,
              title: '❌ Your bet lost',
              body: `Better luck next time. You lost your bet on this market.`,
              type: 'BET_RESULT',
              link: `/market/${marketId}`,
            },
          }),
        );
      }
    }

    // Final: Mark market as resolved
    updates.push(
      prisma.market.update({
        where: { id: marketId },
        data: {
          status: 'RESOLVED',
          winningOutcomeId,
        },
      }),
    );

    await prisma.$transaction(updates);
  } catch (error) {
    res.status(500).json({ error });
  }

  res
    .status(200)
    .json({ message: 'Market resolved. Bets settled and users notified.' });
});

// GET MARKETS

export const getMarketsWithStats = expressAsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const status = req.query.status as string;
  const marketType = req.query.marketType as string;
  const playerId = req.query.playerId as string;

  const skip = (page - 1) * limit;

  // Dynamic filters
  const where: Prisma.MarketWhereInput = {
    AND: [
      search
        ? {
            title: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {},
      status ? { status: status as MarketStatus } : {},
      marketType ? { marketType: marketType as MarketType } : {},
      playerId
        ? {
            players: {
              some: {
                playerId,
              },
            },
          }
        : {},
    ],
  };

  // 1. Paginated Markets
  const markets = await prisma.market.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      status: true,
      marketType: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      sponsoredStake: true,
      feePercent: true,
      creatorFeeShare: true,
      themeColor: true,
      coverUrl: true,
      creatorFeeEarned: true,
      platformFeeEarned: true,
      totalLosers: true,
      totalPools: true,
      creator: {
        select: {
          id: true,
          fullName: true,
          profilePicture: true,
        },
      },
      outcomes: {
        select: {
          id: true,
          label: true,
          totalStaked: true,
          bettorsCount: true,
        },
      },
      players: {
        select: {
          player: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      },
    },
  });

  // 2. Total Markets
  const totalMarkets = await prisma.market.count({ where });

  // 3. Weekly growth stats
  const now = new Date();
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const endOfLastWeek = subDays(startOfThisWeek, 1);

  const thisWeekCount = await prisma.market.count({
    where: {
      createdAt: {
        gte: startOfThisWeek,
      },
    },
  });

  const lastWeekCount = await prisma.market.count({
    where: {
      createdAt: {
        gte: startOfLastWeek,
        lte: endOfLastWeek,
      },
    },
  });

  const growthPercent =
    lastWeekCount === 0
      ? 100
      : ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100;

  // 4. Markets created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.market.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  res.status(200).json({
    markets,
    pagination: {
      total: totalMarkets,
      page,
      limit,
    },
    stats: {
      totalMarkets,
      newMarketsThisWeek: thisWeekCount,
      newMarketsLastWeek: lastWeekCount,
      growthPercent: Math.round(growthPercent * 100) / 100,
      marketsToday: todayCount,
    },
  });
});
