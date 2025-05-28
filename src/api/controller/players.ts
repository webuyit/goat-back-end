import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { Prisma } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';

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
      },
    });
  });

  res.status(201).json({ message: 'Player registered successfully.', player });
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
