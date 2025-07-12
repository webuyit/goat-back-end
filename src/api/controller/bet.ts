import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import {
  calculateOdds,
  simulateOddsWithUserStake,
} from '../lib/calculate-odds';
import { Prisma, BetStatus } from '@prisma/client';
import { startOfWeek, subDays } from 'date-fns';
import {
  BETTING_PLATFORM_FEE,
  REFFERAL_FEE_SHARE,
  SPONSOR_FEE_SHARE,
} from '../lib/constants';
import { calculateFeeBreakdown } from '../lib/fees-calculator';

import { startOfDay, endOfDay } from 'date-fns';

const todayStart = startOfDay(new Date());
const todayEnd = endOfDay(new Date());
export const placeBet2 = expressAsyncHandler(async (req, res) => {
  const { userId, outcomeId, amount } = req.body;

  if (!userId || !outcomeId || !amount || amount <= 0) {
    res.status(400).json({ message: 'Invalid bet input.' });
    throw new Error('Invalid bet input');
  }

  // Fast read-only queries
  const [user, outcome] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.outcome.findUnique({
      where: { id: outcomeId },
      include: { market: true },
    }),
  ]);

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    throw new Error('User not found.');
  }
  if (!outcome) res.status(404).json({ message: 'Outcome not found.' });
  if (user.faucetPoints < amount) {
    res.status(400).json({ message: 'Insufficient balance.' });
    throw new Error('Insufficient balance.');
  }
  if (outcome.market.status !== 'OPEN') {
    res.status(400).json({ message: 'Market is not open for betting.' });
    throw new Error('Market is not open for betting.');
  }

  // --- ENTRY CONDITIONS CHECK ---
  const market = outcome.market;

  if (market.entryType === 'PAID') {
    if (!market.entryFee || user.faucetPoints < market.entryFee) {
      res.status(400).json({
        message: 'Insufficient balance to enter this market (paid entry).',
      });
      throw new Error('Insufficient balance for paid entry');
    }

    // Deduct the entry fee only ONCE per user per market
    const alreadyEntered = await prisma.bet.findFirst({
      where: { userId, outcome: { marketId: market.id } },
    });

    if (!alreadyEntered) {
      await prisma.user.update({
        where: { id: userId },
        data: { faucetPoints: { decrement: market.entryFee } },
      });

      await prisma.platformRevenue.create({
        data: {
          source: 'MARKET_ENTRY_FEE',
          amount: market.entryFee,
          userId,
          marketId: market.id,
        },
      });
    }
  }

  if (market.entryType === 'TOKEN_GATED') {
    if (!market.requiredToken || !market.requiredTokenAmount) {
      res.status(400).json({ message: 'Invalid token gate setup.' });
      throw new Error('Market token gate improperly configured');
    }

    // You’d typically check the user’s wallet off-chain snapshot or via on-chain query
    // Placeholder check for now:
    const userHasToken = true; // simulate token check here

    if (!userHasToken) {
      res.status(403).json({
        message: `You must hold ${market.requiredTokenAmount} ${market.requiredToken} to enter.`,
      });
      throw new Error('Token gating failed');
    }
  }

  const allOutcomes = await prisma.outcome.findMany({
    where: { marketId: outcome.marketId },
  });

  // EXISTING CODE
  const oddsSimulation = simulateOddsWithUserStake(
    allOutcomes,
    outcomeId,
    amount,
  );
  const selectedOutcome = oddsSimulation.find((o) => o.id === outcomeId);
  const oddsAtBet = selectedOutcome?.odds ?? 1;
  const impliedProbability = selectedOutcome.impliedProbability;
  const potentialPayout = selectedOutcome.potentialPayout;
  const potentialProfit = selectedOutcome.potentialProfit;
  //   EXISTING CODE

  // const feeAmount = Math.floor(amount * BETTING_PLATFORM_FEE);
  const feeAmount = Math.max(1, Math.round(amount * BETTING_PLATFORM_FEE));
  // Count user bets BEFORE transaction
  const userBetCount = await prisma.bet.count({ where: { userId } });
  const referrerId = user.referredById;

  const { referralShare, sponsorShare, platformNetFee } = calculateFeeBreakdown(
    {
      feeAmount,
      isSponsored: outcome.market.marketType === 'SPONSORED',
      hasReferrer: Boolean(referrerId),
      userBetCount,
      referralShareRatio: REFFERAL_FEE_SHARE,
      sponsorShareRatio: SPONSOR_FEE_SHARE,
    },
  );

  let placedBet;
  //let referralShare = 0;
  //let finalSponsorShare = 0;
  const notifications = [];

  await prisma.$transaction(async (tx) => {
    const existingBet = await tx.bet.findFirst({
      where: { userId, outcomeId },
    });

    // Deduct balance
    await tx.user.update({
      where: { id: userId },
      data: { faucetPoints: { decrement: amount } },
    });

    // Place the bet
    placedBet = await tx.bet.create({
      data: {
        userId,
        outcomeId,
        amount,
        oddsAtBet,
        potentialPayout,
        status: 'PENDING',
        fee: feeAmount,
      },
    });

    // Update outcome and market pools
    await tx.outcome.update({
      where: { id: outcomeId },
      data: {
        totalStaked: { increment: amount },
        bettorsCount: existingBet ? undefined : { increment: 1 },
        market: {
          update: {
            totalPools: { increment: amount },
          },
        },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        type: 'BET_PLACED',
        transactionId: placedBet.id,
      },
    });

    // GET PLATFORM REVENUE

    await tx.platformRevenue.create({
      data: {
        source: 'FEE',
        amount: platformNetFee,
        marketId: outcome.market.id,
        betId: placedBet.id,
        userId: user.id,
      },
    });

    // Handle referral/sponsor earnings
    const isSponsored = outcome.market.marketType === 'SPONSORED';
    const sponsorId = outcome.market.creatorId;
    //const referrerId = user.referredById;

    console.log(`🔥 REFFERAL ID`, referrerId);
    //console.log(`Is reffered ?`, referrerId)

    if (isSponsored) {
      // const sponsorCut = Math.floor(feeAmount * SPONSOR_FEE_SHARE);
      // const platformNetFee = feeAmount  - sponsorCut;
      if (referrerId && userBetCount < 10) {
        ///referralShare = Math.floor(feeAmount * REFFERAL_FEE_SHARE);
        //finalSponsorShare = sponsorCut - referralShare;

        /*await tx.user.update({
          where: { id: referrerId },
          data: { points: { increment: referralShare } },
        });*/
        await tx.reward.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL',
            source: isSponsored ? 'SPONSORED_MARKET' : 'UNSPONSORED_MARKET',
            betId: placedBet.id,
          },
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

        // DONT LOG TRANSACTION

        /*await tx.transaction.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL_REWARD',
            transactionId: placedBet.id,
          },
        });*/

        notifications.push({
          userId: referrerId,
          title: 'Referral Reward',
          type: 'REWARD',
          body: `You earned ${referralShare} points for referring ${user.fullName}.`,
        });
      }

      if (sponsorShare > 0) {
        /* await tx.user.update({
          where: { id: sponsorId },
          data: { points: { increment: finalSponsorShare } },
        });*/

        // send PRIZE
        await tx.reward.create({
          data: {
            userId: sponsorId,
            amount: sponsorShare,
            type: 'SPONSOR',
            source: 'SPONOSRED_MARKET',
            betId: placedBet.id,
          },
        });

        // DON'T LOG THE TX

        /* await tx.transaction.create({
          data: {
            userId: sponsorId,
            amount: finalSponsorShare,
            type: 'SPONSOR_REWARD',
            transactionId: placedBet.id,
          },
        });*/

        notifications.push({
          userId: sponsorId,
          title: 'Sponsor Reward',
          type: 'REWARD',
          body: `You earned ${sponsorShare} points as sponsor of "${outcome.market.title}".`,
        });
      }
    } else {
      if (referrerId && userBetCount < 10) {
        //referralShare = Math.floor(feeAmount * REFFERAL_FEE_SHARE);
        /* await tx.user.update({
          where: { id: referrerId },
          data: { points: { increment: referralShare } },
        });*/

        await tx.reward.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL',
            source: isSponsored ? 'SPONSORED_MARKET' : 'UNSPONSORED_MARKET',
            betId: placedBet.id,
          },
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

        // DON'T LOG TX
        /* await tx.transaction.create({
          data: {
            userId: referrerId,
            amount: referralShare,
            type: 'REFERRAL_REWARD',
            transactionId: placedBet.id,
          },
        });*/

        notifications.push({
          userId: referrerId,
          title: 'Referral Reward',
          type: 'REWARD',
          body: `You earned ${referralShare} points for referring ${user.fullName}.`,
        });
      }
    }
  });

  // 🔥 Notifications outside transaction
  await Promise.all(
    notifications.map((note) => prisma.notification.create({ data: note })),
  );

  res.status(201).json({
    message: 'Bet placed successfully.',
    bet: placedBet,
    odds: oddsAtBet,
    impliedProbability,
  });
});

export const getBetsWithStats = expressAsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const outcomeId = (req.query.outcomeId as string) || '';

  const skip = (page - 1) * limit;

  // Build filter condition
  const where: Prisma.BetWhereInput = {
    ...(status ? { status: status as BetStatus } : {}),
    ...(outcomeId ? { outcomeId } : {}),
    ...(search
      ? {
          user: {
            fullName: {
              contains: search,
              mode: 'insensitive',
            },
          },
        }
      : {}),
  };

  // 1. Bets list with pagination
  const bets = await prisma.bet.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profilePicture: true,
        },
      },
      outcome: {
        select: {
          id: true,
          label: true,
          market: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  // 2. Total bets
  const totalBets = await prisma.bet.count({ where });

  // 3. Total amount staked
  const totalAmountStaked = await prisma.bet.aggregate({
    where,
    _sum: {
      amount: true,
    },
  });

  // 4. Growth Stats
  const now = new Date();
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const endOfLastWeek = subDays(startOfThisWeek, 1);

  const thisWeekCount = await prisma.bet.count({
    where: {
      createdAt: {
        gte: startOfThisWeek,
      },
    },
  });

  const lastWeekCount = await prisma.bet.count({
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

  // 5. Today's Bets
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.bet.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  res.status(200).json({
    bets,
    pagination: {
      total: totalBets,
      page,
      limit,
    },
    stats: {
      totalBets,
      totalAmountStaked: totalAmountStaked._sum.amount || 0,
      newBetsThisWeek: thisWeekCount,
      newBetsLastWeek: lastWeekCount,
      growthPercent: Math.round(growthPercent * 100) / 100,
      betsToday: todayCount,
    },
  });
});
// GET USER BETS

export const getUserBetsCategorized = expressAsyncHandler(async (req, res) => {
  const { userId, privyId } = req.query;

  if (!userId && !privyId) {
    res.status(400).json({ message: 'Missing userId or privyId' });
  }

  const user = await prisma.user.findFirst({
    where: {
      ...(userId ? { id: userId as string } : {}),
      ...(privyId ? { privyId: privyId as string } : {}),
    },
    select: { id: true },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const betSelect = {
    id: true,
    amount: true,
    potentialPayout: true,
    createdAt: true,
    status: true,
    oddsAtBet: true,
    outcome: {
      select: {
        id: true,
        label: true,
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            endsAt: true,
            resolvedAt: true,
            closedAt: true,
            coverUrl: true,
            Match: {
              select: {
                title: true,
                description: true,
                startsAt: true,
                endsAt: true,
                category: true,
              },
            },
            players: {
              select: {
                player: {
                  select: {
                    id: true,
                    name: true,
                    profilePicture: true,
                    team: {
                      select: {
                        name: true,
                        logo: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  // Parallel fetching
  const [liveBets, openBets, settledBets, resolvedTodayBets] =
    await Promise.all([
      prisma.bet.findMany({
        where: {
          userId: user.id,
          outcome: {
            market: {
              status: 'LIVE',
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: betSelect,
      }),

      prisma.bet.findMany({
        where: {
          userId: user.id,
          outcome: {
            market: {
              status: 'OPEN',
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: betSelect,
      }),

      prisma.bet.findMany({
        where: {
          userId: user.id,
          outcome: {
            market: {
              status: 'RESOLVED',
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: betSelect,
      }),

      // 🎯 Only bets from resolved markets TODAY
      prisma.bet.findMany({
        where: {
          userId: user.id,
          outcome: {
            market: {
              status: 'RESOLVED',
              resolvedAt: {
                gte: todayStart,
                lte: todayEnd,
              },
            },
          },
        },
        select: {
          amount: true,
          potentialPayout: true,
          status: true,
        },
      }),
    ]);

  // 🎯 Calculate profit only from today's resolved bets
  let profit = 0;
  let totalAmountUsed = 0;
  resolvedTodayBets.forEach((bet) => {
    totalAmountUsed += bet.amount;
    if (bet.status === 'WON') {
      profit += bet.potentialPayout - bet.amount;
    } else {
      profit -= bet.amount;
    }
  });

  const formattedProfit = profit.toFixed(2);
  const isPositive = profit >= 0;

  res.status(200).json({
    liveBets,
    openBets,
    settledBets,
    profitToday: {
      amount: formattedProfit,
      isPositive,
      totalAmountUsed: totalAmountUsed.toFixed(2),
    },
  });
});

// GET ODDS
export const getMarketOdds = expressAsyncHandler(async (req, res) => {
  const { marketId } = req.params;
  const { selectedOutcomeId, userAmount } = req.query;

  if (!marketId) {
    res.status(400).json({ message: 'Market ID is required.' });
  }

  const outcomes = await prisma.outcome.findMany({
    where: { marketId },
    select: {
      id: true,
      label: true,
      totalStaked: true,
    },
  });

  if (!outcomes || outcomes.length === 0) {
    res.status(404).json({ message: 'No outcomes found for this market.' });
  }

  const oddsData = calculateOdds(outcomes);

  let potentialPayout: number | null = null;

  if (selectedOutcomeId && userAmount) {
    const selected = oddsData.find((o) => o.id === selectedOutcomeId);

    if (selected) {
      const userAmountNumber = parseFloat(userAmount as string);
      if (!isNaN(userAmountNumber) && userAmountNumber > 0) {
        potentialPayout = parseFloat(
          (selected.odds * userAmountNumber).toFixed(2),
        );
      }
    }
  }

  res.status(200).json({
    marketId,
    odds: oddsData,
    selectedOutcomeId: selectedOutcomeId || null,
    userAmount: userAmount || null,
    potentialPayout,
  });
});
