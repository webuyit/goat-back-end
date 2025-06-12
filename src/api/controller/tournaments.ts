import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { RewardType } from '@prisma/client';
// create Tournament
export const createTournament = expressAsyncHandler(async (req, res) => {
  const {
    title,
    description,
    startsAt,
    endsAt,
    entryType = 'FREE',
    entryFee,
    requiredToken,
    requiredTokenAmount,
    coverUrl,
    creatorId,
    entryDescription,
    prizePool,
    themeColor,
    marketIds = [],
  } = req.body;

  // Basic validation
  if (!title || !startsAt || !endsAt || !creatorId) {
    res.status(400).json({ message: 'Missing required tournament fields.' });
    return;
  }

  if (entryType === 'PAID' && (!entryFee || entryFee <= 0)) {
    res.status(400).json({ message: 'Paid tournaments require entry fee.' });
    return;
  }

  if (
    entryType === 'TOKEN_GATED' &&
    (!requiredToken || !requiredToken || requiredTokenAmount <= 0)
  ) {
    res
      .status(400)
      .json({ message: 'Token gated tournaments need token info.' });
    return;
  }

  try {
    const newTournament = await prisma.tournament.create({
      data: {
        title,
        description,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        entryType,
        entryFee,
        requiredToken,
        requiredTokenAmount,
        coverUrl,
        creatorId,
        prizePool,
        entryDescription,
        themeColor,
        markets: {
          connect: marketIds.map((id: string) => ({ id })),
        },
      },
      include: {
        markets: true,
      },
    });

    res.status(201).json({
      message: 'Tournament created successfully.',
      tournament: newTournament,
    });
  } catch (error) {
    console.error('Failed to create tournament:', error);
    res.status(500).json({ message: 'Error creating tournament.', error });
  }
});

// Join tournament
export const joinTournament = expressAsyncHandler(async (req, res) => {
  const { tournamentId, userId } = req.body;

  if (!tournamentId || !userId) {
    res.status(400).json({ message: 'Missing tournamentId or userId.' });
    return;
  }

  const [user, tournament] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: true },
    }),
  ]);

  if (!user || !tournament) {
    res.status(404).json({ message: 'User or tournament not found.' });
    return;
  }

  if (tournament.status === 'COMPLETED') {
    res.status(400).json({ message: 'Tournament has already ended.' });
    return;
  }

  const alreadyJoined = tournament.participants.find(
    (p) => p.userId === userId,
  );
  if (alreadyJoined) {
    res.status(400).json({ message: 'User already joined this tournament.' });
    return;
  }

  if (tournament.entryType === 'PAID') {
    if (!tournament.entryFee || user.faucetPoints < tournament.entryFee) {
      res
        .status(400)
        .json({ message: 'Insufficient balance to join this tournament.' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        faucetPoints: { decrement: tournament.entryFee },
      },
    });

    // Optional: track revenue
    await prisma.platformRevenue.create({
      data: {
        source: 'TOURNAMENT_ENTRY_FEE',
        amount: tournament.entryFee,
        userId,
      },
    });
  }

  if (tournament.entryType === 'TOKEN_GATED') {
    // 💡 Replace this with real token balance check later
    const userHasToken = true; // simulate token ownership
    const hasEnough = true; // simulate token amount check

    if (!userHasToken || !hasEnough) {
      res.status(403).json({
        message:
          'You do not meet the token requirement to join this tournament.',
      });
      return;
    }
  }

  const participant = await prisma.tournamentParticipant.create({
    data: {
      tournamentId,
      userId,
    },
  });

  res.status(201).json({
    message: 'Successfully joined tournament.',
    participant,
  });
});

// Get tournament participants
export const getTournamentParticipants = expressAsyncHandler(
  async (req, res) => {
    const { id: tournamentId } = req.params;

    if (!tournamentId) {
      res.status(400).json({ message: 'Missing tournament ID' });
      return;
    }

    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.status(200).json({ participants });
  },
);

export const getTournamentLeaderboard = expressAsyncHandler(
  async (req, res) => {
    const { id: tournamentId } = req.params;

    if (!tournamentId) {
      res.status(400).json({ message: 'Missing tournament ID' });
      return;
    }

    // Step 1: Fetch all markets tied to this tournament
    const tournamentMarkets = await prisma.market.findMany({
      where: { tournamentId },
      select: { id: true },
    });

    const marketIds = tournamentMarkets.map((m) => m.id);

    if (marketIds.length === 0) {
      res.status(200).json({ leaderboard: [] }); // No markets = no scores
      return;
    }

    // Step 2: Group and sum all WON bets from those markets
    const leaderboard = await prisma.bet.groupBy({
      by: ['userId'],
      where: {
        status: 'WON',
        outcome: {
          marketId: { in: marketIds },
        },
      },
      _sum: {
        potentialPayout: true,
      },
      orderBy: {
        _sum: {
          potentialPayout: 'desc',
        },
      },
    });

    // Step 3: Join with user profiles
    const userIds = leaderboard.map((entry) => entry.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        fullName: true,
        profilePicture: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      winnings: entry._sum.potentialPayout ?? 0,
      user: userMap.get(entry.userId),
    }));

    res.status(200).json({ leaderboard: rankedLeaderboard });
  },
);

// RESOLVE TOURNAMENT

export const resolveTournament = expressAsyncHandler(async (req, res) => {
  const { tournamentId } = req.params;

  if (!tournamentId) {
    res.status(400).json({ message: 'Missing tournamentId.' });
    return;
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      markets: true,
      participants: {
        include: { user: true },
      },
    },
  });

  if (!tournament) {
    res.status(404).json({ message: 'Tournament not found.' });
    return;
  }

  const unresolvedMarkets = tournament.markets.filter(
    (market) => market.status !== 'RESOLVED',
  );

  if (unresolvedMarkets.length > 0) {
    res.status(400).json({
      message: 'Cannot resolve tournament. Some markets are still unresolved.',
      unresolvedMarketIds: unresolvedMarkets.map((m) => m.id),
    });
    return;
  }

  // Leaderboard: Sort participants by `score`
  const leaderboard = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    orderBy: { score: 'desc' },
    take: 5,
  });

  const prizeDistribution = [0.5, 0.25, 0.15, 0.07, 0.03]; // MOCK UP DATA
  const totalPrize = tournament.prizePool || 0;

  const rewards = leaderboard.map((participant, index) => {
    const share = prizeDistribution[index] || 0;
    const rewardAmount = Math.floor(totalPrize * share);
    return {
      user: { connect: { id: participant.userId } },
      amount: rewardAmount,
      type: RewardType.TOURNAMENT,
      source: `TOURNAMENT:${tournament.title}`,
      //tournamentId: tournament.id,
    };
  });

  await prisma.$transaction([
    // Create rewards
    ...rewards.map((reward) => prisma.reward.create({ data: reward })),

    // Update tournament status
    prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'COMPLETED',
        resolvedAt: new Date(),
      },
    }),

    // Notify all participants
    ...tournament.participants.map((p) =>
      prisma.notification.create({
        data: {
          userId: p.userId,
          title: '🏆 Tournament Ended!',
          type: 'TOURNAMENT_RESULT',
          body: `Tournament "${tournament.title}" has ended. Check the leaderboard and claim your reward if eligible.`,
          link: `/tournaments/${tournament.id}`,
        },
      }),
    ),
  ]);

  res.status(200).json({
    message: 'Tournament resolved successfully.',
    leaderboard,
  });
});

//GET USER TOURNAMENTS

export const getUserTournaments = expressAsyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.query; // optional filter

  if (!userId) {
    res.status(400).json({ message: 'Missing userId' });
    return;
  }

  const where: any = {
    userId,
  };

  if (status && typeof status === 'string') {
    where.league = {
      status: status.toUpperCase(), // assuming TournamentStatus enum
    };
  }

  const tournaments = await prisma.tournamentParticipant.findMany({
    where,
    include: {
      league: true,
    },
    orderBy: {
      joinedAt: 'desc',
    },
  });

  res.status(200).json({
    joinedTournaments: tournaments.map((tp) => ({
      tournament: tp.league,
      joinedAt: tp.joinedAt,
      score: tp.score,
    })),
  });
});

export const getTournaments = expressAsyncHandler(async (req, res) => {
  const {
    type,
    entryType,
    status,
    creatorId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = req.query;

  try {
    const filters: any = {};

    if (type) filters.type = type;
    if (entryType) filters.entryType = entryType;
    if (status) filters.status = status;
    if (creatorId) filters.creatorId = creatorId;
    if (search) {
      filters.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where: filters,
        orderBy: { [sortBy as string]: sortOrder },
        skip,
        take,
        include: {
          _count: {
            select: { participants: true },
          },
          markets: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      prisma.tournament.count({ where: filters }),
    ]);

    res.status(200).json({
      tornaments: tournaments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching tournaments', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});
