import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { Prisma } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import { calculateOdds } from '../lib/calculate-odds';

// Register player without league
export const registerPlayerWithTeamAndNationality = expressAsyncHandler(
  async (req, res) => {
    const { name, team, nationality, profilePicture, mainColor } = req.body;

    if (!name || !team?.name || !nationality?.name) {
      res.status(400).json({
        message: 'Player name, team name, and nationality name are required.',
      });
    }

    // Upsert Team
    const teamRecord = await prisma.team.upsert({
      where: { name: team.name },
      update: { logo: team.logo },
      create: {
        name: team.name,
        logo: team.logo,
      },
    });

    // Upsert Nationality
    const nationalityRecord = await prisma.nationality.upsert({
      where: { name: nationality.name },
      update: { flag: nationality.flag },
      create: {
        name: nationality.name,
        flag: nationality.flag,
      },
    });

    // Create Player
    const player = await prisma.player.create({
      data: {
        name,
        teamId: teamRecord.id,
        nationalityId: nationalityRecord.id,
        profilePicture,
        mainColor,
      },
    });

    res.status(201).json({
      message: 'Player registered successfully.',
      player,
      team: teamRecord,
      nationality: nationalityRecord,
    });
  },
);

// REGISTER PLAYER WITH TEAM NATIONALITY AND LEAGUE
export const registerPlayer1 = expressAsyncHandler(async (req, res) => {
  const {
    name,
    profilePicture,
    mainColor,
    teamName,
    teamLogo,
    nationalityName,
    nationalityFlag,
    leagueName,
    leagueLogo,
    age,
  } = req.body;

  if (!name || !teamName || !nationalityName || !leagueName) {
    res.status(400).json({ message: 'Missing required fields.' });
  }

  const player = await prisma.$transaction(async (tx) => {
    // 1. Upsert League
    const league = await tx.league.upsert({
      where: { name: leagueName },
      update: { logo: leagueLogo },
      create: { name: leagueName, logo: leagueLogo },
    });

    // 2. Upsert Nationality
    const nationality = await tx.nationality.upsert({
      where: { name: nationalityName },
      update: { flag: nationalityFlag },
      create: { name: nationalityName, flag: nationalityFlag },
    });

    // 3. Upsert Team (linked to league)
    const team = await tx.team.upsert({
      where: { name: teamName },
      update: {
        logo: teamLogo,
        leagueId: league.id,
      },
      create: {
        name: teamName,
        logo: teamLogo,
        leagueId: league.id,
      },
    });

    // 4. Create Player
    return await tx.player.create({
      data: {
        name,
        profilePicture,
        mainColor,
        teamId: team.id,
        nationalityId: nationality.id,
        age,
      },
    });
  });

  res.status(201).json({ message: 'Player registered successfully.', player });
});

export const registerPlayer = expressAsyncHandler(async (req, res) => {
  const {
    name,
    profilePicture,
    mainColor,
    teamName,
    teamLogo,
    nationalityName,
    nationalityFlag,
    leagueName,
    leagueLogo,
    age,
  } = req.body;

  // Validate required fields
  if (!name || !teamName || !nationalityName || !leagueName) {
    res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    // 1. Upsert League
    const league = await prisma.league.upsert({
      where: { name: leagueName },
      update: { logo: leagueLogo },
      create: { name: leagueName, logo: leagueLogo },
    });

    // 2. Upsert Nationality
    const nationality = await prisma.nationality.upsert({
      where: { name: nationalityName },
      update: { flag: nationalityFlag },
      create: { name: nationalityName, flag: nationalityFlag },
    });

    // 3. Upsert Team (linked to league)
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {
        logo: teamLogo,
        leagueId: league.id,
      },
      create: {
        name: teamName,
        logo: teamLogo,
        leagueId: league.id,
      },
    });

    // 4. Create Player
    const player = await prisma.player.create({
      data: {
        name,
        profilePicture,
        mainColor,
        teamId: team.id,
        nationalityId: nationality.id,
        age,
      },
    });

    res.status(201).json(player);
  } catch (error) {
    console.error('Register player failed:', error);
    res.status(500).json({ message: 'Failed to register player.' });
  }
});

// GET PLAYERS

export const getPlayersWithStats = expressAsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const teamId = req.query.teamId as string;
  const leagueId = req.query.leagueId as string;

  const skip = (page - 1) * limit;

  // Build filters
  const where: Prisma.PlayerWhereInput = {
    AND: [
      search
        ? {
            name: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {},
      teamId ? { teamId } : {},
      leagueId
        ? {
            team: {
              leagueId,
            },
          }
        : {},
    ],
  };

  // 1. Paginated players
  const players = await prisma.player.findMany({
    where,
    skip,
    take: limit,
    select: {
      id: true,
      name: true,
      mainColor: true,
      profilePicture: true,
      createdAt: true,
      team: {
        select: {
          id: true,
          name: true,
          logo: true,
          league: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      nationality: {
        select: {
          id: true,
          name: true,
          flag: true,
        },
      },
    },
  });

  // 2. Total players
  const totalPlayers = await prisma.player.count({ where });

  // 3. Weekly stats
  const now = new Date();
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const endOfLastWeek = subDays(startOfThisWeek, 1);

  const thisWeekCount = await prisma.player.count({
    where: {
      createdAt: {
        gte: startOfThisWeek,
      },
    },
  });

  const lastWeekCount = await prisma.player.count({
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

  // 4. Players created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.player.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  res.status(200).json({
    players,
    pagination: {
      total: totalPlayers,
      page,
      limit,
    },
    stats: {
      totalPlayers,
      newPlayersThisWeek: thisWeekCount,
      newPlayersLastWeek: lastWeekCount,
      growthPercent: Math.round(growthPercent * 100) / 100,
      playersToday: todayCount,
    },
  });
});

// GET FEATURED PLAYERS
export const getPlayersWithBasicInfo2 = expressAsyncHandler(
  async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const featured = req.query.featured === 'true';
    const orderBy = (req.query.orderBy as string) || 'createdAt';
    const direction =
      (req.query.direction as string) === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    // Build where filter
    const where: Prisma.PlayerWhereInput = {
      ...(search && {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(featured && { featured: true }),
    };

    const players = await prisma.player.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [orderBy]: direction,
      },
      select: {
        id: true,
        name: true,
        profilePicture: true,
        mainColor: true,
        featured: true,
        team: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        nationality: {
          select: {
            id: true,
            name: true,
            flag: true,
          },
        },
      },
    });

    const total = await prisma.player.count({ where });

    res.status(200).json({
      players,
      pagination: {
        total,
        page,
        limit,
      },
    });
  },
);

//GET PLAYERS WITH BASIC INFO ORDERED BY IS FEATURED

export const getPlayersWithBasicInfo = expressAsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const featured = req.query.featured === 'true';
  const orderBy = (req.query.orderBy as string) || 'createdAt';
  const direction = (req.query.direction as string) === 'asc' ? 'asc' : 'desc';

  const skip = (page - 1) * limit;

  // Build where filter
  const where: Prisma.PlayerWhereInput = {
    ...(search && {
      name: {
        contains: search,
        mode: Prisma.QueryMode.insensitive,
      },
    }),
    ...(featured && { featured: true }),
  };

  const players = await prisma.player.findMany({
    where,
    skip,
    take: limit,
    orderBy: [
      { featured: 'desc' }, // 🎯 Always featured first
      { [orderBy]: direction }, // 👈 Then sort by any custom field
    ],
    select: {
      id: true,
      name: true,
      profilePicture: true,
      mainColor: true,
      featured: true,
      team: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
      nationality: {
        select: {
          id: true,
          name: true,
          flag: true,
        },
      },
    },
  });

  const total = await prisma.player.count({ where });

  res.status(200).json({
    players,
    pagination: {
      total,
      page,
      limit,
    },
  });
});

// GET PLAYER PROFILE

export const getPlayerById = expressAsyncHandler(async (req, res) => {
  const playerId = req.params.id;

  const { marketStatus, tournamentStatus } = req.query;

  if (!playerId) {
    res.status(400).json({ message: 'Player ID is required' });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      nationality: {
        select: { id: true, name: true, flag: true },
      },
      team: {
        select: {
          id: true,
          name: true,
          logo: true,
          league: {
            select: { id: true, name: true, logo: true },
          },
        },
      },
      stats: {
        orderBy: { date: 'desc' },
      },
      markets: {
        where: marketStatus
          ? {
              market: {
                status: marketStatus as any,
              },
            }
          : {},
        select: {
          market: {
            select: {
              id: true,
              title: true,
              status: true,
              marketType: true,
              startsAt: true,
              endsAt: true,
              coverUrl: true,
              description: true,
              totalPools: true,
              outcomes: true,
              //players: true,
            },
          },
        },
      },
    },
  });

  if (!player) {
    res.status(404).json({ message: 'Player not found' });
  }

  // Format markets and tournaments
  const markets = player.markets.map((entry) => entry.market);
  // markets with odd
  const enhancedMarkets = markets.map((market) => {
    const outcomesWithOdds = calculateOdds(market.outcomes);
    return {
      ...market,
      outcomes: outcomesWithOdds,
    };
  });
  //const tournaments = player.playersInTournaments.map((entry) => entry.tournament)

  res.status(200).json({
    ...player,
    markets: enhancedMarkets,
    //tournaments,
  });
});

// ADD PLAYER STATS

// POST /api/player-stats
export const createPlayerStat = expressAsyncHandler(async (req, res) => {
  const {
    playerId,
    date,
    goals = 0,
    assists = 0,
    minutes = 0,
    scoreRate = 0,
    yellowCards = 0,
    redCards = 0,
    points = 0,
    avarageScore = 0,
    isInjured = false,
  } = req.body;

  // Check if player exists
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    res.status(404);
    throw new Error('Player not found');
  }

  // Create new PlayerStat
  try {
    const playerStat = await prisma.playerStat.create({
      data: {
        playerId,
        date: new Date(date),
        goals,
        assists,
        minutes,
        scoreRate,
        yellowCards,
        redCards,
        points,
        avarageScore,
        isInjured,
      },
    });
    res.status(201).json(playerStat);
  } catch (error) {
    res.status(500).json(error);
  }
});

export const bulkCreatePlayerStats = expressAsyncHandler(async (req, res) => {
  const statsArray = req.body;

  if (!Array.isArray(statsArray) || statsArray.length === 0) {
    res.status(400);
    throw new Error('Request body must be a non-empty array');
  }

  // Optionally: validate each item manually or with zod/yup

  const validStats = [];

  for (const stat of statsArray) {
    const {
      playerId,
      date,
      goals = 0,
      assists = 0,
      minutes = 0,
      scoreRate = 0,
      yellowCards = 0,
      redCards = 0,
      points = 0,
      avarageScore = 0,
      isInjured = false,
    } = stat;

    // Verify player exists
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    if (!player) {
      // Skip or log failed entry — you can also choose to throw here
      console.warn(`Skipping stat: Player not found for ID ${playerId}`);
      continue;
    }

    validStats.push({
      playerId,
      date: new Date(date),
      goals,
      assists,
      minutes,
      scoreRate,
      yellowCards,
      redCards,
      points,
      avarageScore,
      isInjured,
    });
  }

  if (validStats.length === 0) {
    res.status(400);
    throw new Error('No valid stats to upload');
  }

  const created = await prisma.playerStat.createMany({
    data: validStats,
  });

  res.status(201).json({
    message: `Successfully inserted ${created.count} player stats.`,
  });
});
