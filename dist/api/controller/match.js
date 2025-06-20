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
exports.updateMatch = exports.getMatches = exports.createMatch = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
exports.createMatch = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, teamAName, teamBName, teamALogo, teamBLogo, startsAt, endsAt, leagueName, coverUrl, category, } = req.body;
    if (!title || !startsAt || !teamAName || !teamBName) {
        res.status(400).json({ message: 'Missing required fields.' });
        return;
    }
    try {
        // 1. Find or create league
        let league = null;
        if (leagueName) {
            league = yield prisma_client_1.default.league.upsert({
                where: { name: leagueName },
                update: {},
                create: { name: leagueName },
            });
        }
        // 2. Find or create Team A
        const existingTeamA = yield prisma_client_1.default.team.findFirst({
            where: { name: teamAName },
        });
        const teamARecord = existingTeamA
            ? existingTeamA
            : yield prisma_client_1.default.team.create({
                data: {
                    name: teamAName,
                    logo: teamALogo || '',
                    leagueId: (league === null || league === void 0 ? void 0 : league.id) || null,
                },
            });
        // 3. Find or create Team B
        const existingTeamB = yield prisma_client_1.default.team.findFirst({
            where: { name: teamBName },
        });
        const teamBRecord = existingTeamB
            ? existingTeamB
            : yield prisma_client_1.default.team.create({
                data: {
                    name: teamBName,
                    logo: teamBLogo || '',
                    leagueId: (league === null || league === void 0 ? void 0 : league.id) || null,
                },
            });
        // 4. Create Match
        const match = yield prisma_client_1.default.match.create({
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
    }
    catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ message: 'Failed to create match', error });
    }
}));
// GET /matches?category=ESPORT&status=UPCOMING&sort=startsAt:asc
exports.getMatches = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category, status, sort = 'startsAt:asc', league, search, } = req.query;
        // const [sortField, sortOrder] = sort.split(":");
        const sortParam = typeof sort === 'string' ? sort : 'startsAt:asc';
        const [sortField, sortOrder] = sortParam.split(':');
        const where = {};
        if (category)
            where.category = category;
        if (status)
            where.matchStatus = status;
        if (league)
            where.leagueName = { contains: league, mode: 'insensitive' };
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const matches = yield prisma_client_1.default.match.findMany({
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
    }
    catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Update match contents
// PATCH /matches/:id
exports.updateMatch = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, startsAt, endsAt, matchStatus, teamAId, teamBId, category, } = req.body;
    try {
        const match = yield prisma_client_1.default.match.update({
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
    }
    catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({ error: 'Failed to update match.' });
    }
}));
