"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCreatePlayerStats = exports.createPlayerStat = exports.getPlayerById = exports.getPlayersWithBasicInfo = exports.getPlayersWithStats = exports.registerPlayer = exports.registerPlayer1 = exports.registerPlayerWithTeamAndNationality = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
// Register player without league
exports.registerPlayerWithTeamAndNationality = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, team, nationality, profilePicture, mainColor } = req.body;
    if (!name || !(team === null || team === void 0 ? void 0 : team.name) || !(nationality === null || nationality === void 0 ? void 0 : nationality.name)) {
        res.status(400).json({
            message: 'Player name, team name, and nationality name are required.',
        });
    }
    // Upsert Team
    const teamRecord = yield prisma_client_1.default.team.upsert({
        where: { name: team.name },
        update: { logo: team.logo },
        create: {
            name: team.name,
            logo: team.logo,
        },
    });
    // Upsert Nationality
    const nationalityRecord = yield prisma_client_1.default.nationality.upsert({
        where: { name: nationality.name },
        update: { flag: nationality.flag },
        create: {
            name: nationality.name,
            flag: nationality.flag,
        },
    });
    // Create Player
    const player = yield prisma_client_1.default.player.create({
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
}));
// REGISTER PLAYER WITH TEAM NATIONALITY AND LEAGUE
exports.registerPlayer1 = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, profilePicture, mainColor, teamName, teamLogo, nationalityName, nationalityFlag, leagueName, leagueLogo, age, } = req.body;
    if (!name || !teamName || !nationalityName || !leagueName) {
        res.status(400).json({ message: 'Missing required fields.' });
    }
    const player = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Upsert League
        const league = yield tx.league.upsert({
            where: { name: leagueName },
            update: { logo: leagueLogo },
            create: { name: leagueName, logo: leagueLogo },
        });
        // 2. Upsert Nationality
        const nationality = yield tx.nationality.upsert({
            where: { name: nationalityName },
            update: { flag: nationalityFlag },
            create: { name: nationalityName, flag: nationalityFlag },
        });
        // 3. Upsert Team (linked to league)
        const team = yield tx.team.upsert({
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
        return yield tx.player.create({
            data: {
                name,
                profilePicture,
                mainColor,
                teamId: team.id,
                nationalityId: nationality.id,
                age,
            },
        });
    }));
    res.status(201).json({ message: 'Player registered successfully.', player });
}));
exports.registerPlayer = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, profilePicture, mainColor, teamName, teamLogo, nationalityName, nationalityFlag, leagueName, leagueLogo, age, } = req.body;
    // Validate required fields
    if (!name || !teamName || !nationalityName || !leagueName) {
        res.status(400).json({ message: 'Missing required fields.' });
    }
    try {
        // 1. Upsert League
        const league = yield prisma_client_1.default.league.upsert({
            where: { name: leagueName },
            update: { logo: leagueLogo },
            create: { name: leagueName, logo: leagueLogo },
        });
        // 2. Upsert Nationality
        const nationality = yield prisma_client_1.default.nationality.upsert({
            where: { name: nationalityName },
            update: { flag: nationalityFlag },
            create: { name: nationalityName, flag: nationalityFlag },
        });
        // 3. Upsert Team (linked to league)
        const team = yield prisma_client_1.default.team.upsert({
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
        const player = yield prisma_client_1.default.player.create({
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
    }
    catch (error) {
        console.error('Register player failed:', error);
        res.status(500).json({ message: 'Failed to register player.' });
    }
}));
// GET PLAYERS
exports.getPlayersWithStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const teamId = req.query.teamId;
    const leagueId = req.query.leagueId;
    const skip = (page - 1) * limit;
    // Build filters
    const where = {
        AND: [
            search
                ? {
                    name: {
                        contains: search,
                        mode: client_1.Prisma.QueryMode.insensitive,
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
    const players = yield prisma_client_1.default.player.findMany({
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
    const totalPlayers = yield prisma_client_1.default.player.count({ where });
    // 3. Weekly stats
    const now = new Date();
    const startOfThisWeek = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 });
    const startOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 7);
    const endOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 1);
    const thisWeekCount = yield prisma_client_1.default.player.count({
        where: {
            createdAt: {
                gte: startOfThisWeek,
            },
        },
    });
    const lastWeekCount = yield prisma_client_1.default.player.count({
        where: {
            createdAt: {
                gte: startOfLastWeek,
                lte: endOfLastWeek,
            },
        },
    });
    const growthPercent = lastWeekCount === 0
        ? 100
        : ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100;
    // 4. Players created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = yield prisma_client_1.default.player.count({
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
}));
// GET FEATURED PLAYERS
exports.getPlayersWithBasicInfo = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const featured = req.query.featured === 'true';
    const orderBy = req.query.orderBy || 'createdAt';
    const direction = req.query.direction === 'asc' ? 'asc' : 'desc';
    const skip = (page - 1) * limit;
    // Build where filter
    const where = Object.assign(Object.assign({}, (search && {
        name: {
            contains: search,
            mode: client_1.Prisma.QueryMode.insensitive,
        },
    })), (featured && { featured: true }));
    const players = yield prisma_client_1.default.player.findMany({
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
    const total = yield prisma_client_1.default.player.count({ where });
    res.status(200).json({
        players,
        pagination: {
            total,
            page,
            limit,
        },
    });
}));
// GET PLAYER PROFILE
exports.getPlayerById = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const playerId = req.params.id;
    const { marketStatus, tournamentStatus } = req.query;
    if (!playerId) {
        res.status(400).json({ message: 'Player ID is required' });
    }
    const player = yield prisma_client_1.default.player.findUnique({
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
                            status: marketStatus,
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
    //const tournaments = player.playersInTournaments.map((entry) => entry.tournament)
    res.status(200).json(Object.assign(Object.assign({}, player), { markets }));
}));
// ADD PLAYER STATS
// POST /api/player-stats
exports.createPlayerStat = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { playerId, date, goals = 0, assists = 0, minutes = 0, scoreRate = 0, yellowCards = 0, redCards = 0, points = 0, avarageScore = 0, isInjured = false, } = req.body;
    // Check if player exists
    const player = yield prisma_client_1.default.player.findUnique({
        where: { id: playerId },
    });
    if (!player) {
        res.status(404);
        throw new Error('Player not found');
    }
    // Create new PlayerStat
    try {
        const playerStat = yield prisma_client_1.default.playerStat.create({
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
    }
    catch (error) {
        res.status(500).json(error);
    }
}));
exports.bulkCreatePlayerStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const statsArray = req.body;
    if (!Array.isArray(statsArray) || statsArray.length === 0) {
        res.status(400);
        throw new Error('Request body must be a non-empty array');
    }
    // Optionally: validate each item manually or with zod/yup
    const validStats = [];
    for (const stat of statsArray) {
        const { playerId, date, goals = 0, assists = 0, minutes = 0, scoreRate = 0, yellowCards = 0, redCards = 0, points = 0, avarageScore = 0, isInjured = false, } = stat;
        // Verify player exists
        const player = yield prisma_client_1.default.player.findUnique({ where: { id: playerId } });
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
    const created = yield prisma_client_1.default.playerStat.createMany({
        data: validStats,
    });
    res.status(201).json({
        message: `Successfully inserted ${created.count} player stats.`,
    });
}));
