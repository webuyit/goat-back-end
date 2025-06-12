import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';

export const createMatch = expressAsyncHandler(async (req, res) => {
  const {
    title,
    description,
    teamAName,
    teamBName,
    teamALogo,
    teamBLogo,
    startsAt,
    endsAt,
    leagueName,
    coverUrl,
    category,
  } = req.body;

  if (!title || !startsAt || !teamAName || !teamBName) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    // 1. Find or create league
    let league = null;
    if (leagueName) {
      league = await prisma.league.upsert({
        where: { name: leagueName },
        update: {},
        create: { name: leagueName },
      });
    }

    // 2. Find or create Team A
    const existingTeamA = await prisma.team.findFirst({
      where: { name: teamAName },
    });
    const teamARecord = existingTeamA
      ? existingTeamA
      : await prisma.team.create({
          data: {
            name: teamAName,
            logo: teamALogo || '',
            leagueId: league?.id || null,
          },
        });

    // 3. Find or create Team B
    const existingTeamB = await prisma.team.findFirst({
      where: { name: teamBName },
    });
    const teamBRecord = existingTeamB
      ? existingTeamB
      : await prisma.team.create({
          data: {
            name: teamBName,
            logo: teamBLogo || '',
            leagueId: league?.id || null,
          },
        });

    // 4. Create Match
    const match = await prisma.match.create({
      data: {
        title,
        description,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        teamAId: teamARecord.id,
        teamBId: teamBRecord.id,
        category,
        coverUrl,
      },
    });

    res.status(201).json({ message: 'Match created successfully', match });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ message: 'Failed to create match', error });
  }
});

// GET /matches?category=ESPORT&status=UPCOMING&sort=startsAt:asc
export const getMatches = expressAsyncHandler(async (req, res) => {
  try {
    const {
      category,
      status,
      sort = 'startsAt:asc',
      league,
      search,
    } = req.query;

    // const [sortField, sortOrder] = sort.split(":");
    const sortParam = typeof sort === 'string' ? sort : 'startsAt:asc';
    const [sortField, sortOrder] = sortParam.split(':');

    const where: any = {};

    if (category) where.category = category;
    if (status) where.matchStatus = status;
    if (league) where.leagueName = { contains: league, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: {
        [sortField]: sortOrder === 'desc' ? 'desc' : 'asc',
      },
      include: {
        teamA: true,
        teamB: true,
        markets: true,
      },
    });

    res.status(200).json({ matches });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update match contents

// PATCH /matches/:id
export const updateMatch = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    startsAt,
    endsAt,
    matchStatus,
    teamAId,
    teamBId,
    category,
  } = req.body;

  try {
    const match = await prisma.match.update({
      where: { id },
      data: {
        title,
        description,
        startsAt,
        endsAt,
        matchStatus,
        teamAId,
        teamBId,
        category,
      },
    });

    res.status(200).json({ message: 'Match updated successfully!', match });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match.' });
  }
});
