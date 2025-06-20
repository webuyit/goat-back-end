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
exports.getMarkets = exports.getMarketsWithStats = exports.resolveMarket2 = exports.resolveMarket = exports.createInHouseMarket = exports.createSponsoredMarket = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
const date_fns_1 = require("date-fns");
const client_1 = require("@prisma/client");
const calculate_odds_1 = require("../lib/calculate-odds");
exports.createSponsoredMarket = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, outcomes, stakeAmount, userId, playerIds, endsAt, startsAt, coverUrl, themeColor, } = req.body;
    if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
        res.status(400).json({
            message: 'Invalid market data. Title and at least 2 outcomes are required.',
        });
    }
    const user = yield prisma_client_1.default.user.findUnique({ where: { id: userId } });
    if (!user || user.points < stakeAmount) {
        res
            .status(400)
            .json({ message: 'Insufficient balance to sponsor market.' });
    }
    let createdMarket;
    // Perform all DB operations in a transaction
    yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Deduct the user's points (lock stake)
        yield tx.user.update({
            where: { id: userId },
            data: {
                points: {
                    decrement: stakeAmount,
                },
            },
        });
        // 2. Create the market and associated outcomes
        createdMarket = yield tx.market.create({
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
        yield tx.transaction.create({
            data: {
                user: { connect: { id: userId } },
                amount: stakeAmount,
                type: 'MARKET_CREATED',
                transactionId: createdMarket.id,
            },
        });
    }));
    // Respond AFTER the transaction completes
    res.status(201).json({
        message: 'Market created successfully.',
        marketId: createdMarket.id,
    });
}));
exports.createInHouseMarket = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, outcomes, userId, playerIds, startsAt, endsAt, coverUrl, themeColor, matchId, description, } = req.body;
    if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
        res.status(400).json({
            message: 'Invalid market data. Title and at least 2 outcomes are required.',
        });
    }
    // Optional: validate user exists (e.g., admin or internal system)
    const user = yield prisma_client_1.default.user.findUnique({ where: { id: userId } });
    if (!user) {
        res.status(404).json({ message: 'User not found.' });
    }
    // Create the market (no stake deducted)
    const market = yield prisma_client_1.default.market.create({
        data: {
            title,
            description,
            status: 'OPEN',
            marketType: 'FRIENDLY', // you can define this in your enum
            creatorId: userId,
            startsAt,
            endsAt,
            coverUrl,
            themeColor,
            matchId,
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
}));
// RESLOVE MARKET
exports.resolveMarket = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketId, winningOutcomeId } = req.body;
    if (!marketId || !winningOutcomeId) {
        res.status(400).json({ message: 'Missing marketId or winningOutcomeId.' });
        return;
    }
    try {
        // Fetch market + outcomes + all bets
        const outcomes = yield prisma_client_1.default.outcome.findMany({
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
                updates.push(prisma_client_1.default.bet.update({
                    where: { id: bet.id },
                    data: { status: 'WON' },
                }), prisma_client_1.default.user.update({
                    where: { id: bet.userId },
                    data: { points: { increment: payout } },
                }), prisma_client_1.default.transaction.create({
                    data: {
                        userId: bet.userId,
                        amount: payout,
                        type: 'BET_WON',
                        transactionId: bet.id,
                    },
                }), prisma_client_1.default.notification.create({
                    data: {
                        userId: bet.userId,
                        title: '🎉 You won your bet!',
                        body: `You won ${payout} points on your bet.`,
                        type: 'BET_RESULT',
                        link: `/market/${marketId}`,
                    },
                }));
            }
            else {
                updates.push(prisma_client_1.default.bet.update({
                    where: { id: bet.id },
                    data: { status: 'LOST' },
                }), prisma_client_1.default.notification.create({
                    data: {
                        userId: bet.userId,
                        title: '❌ Your bet lost',
                        body: `Better luck next time. You lost your bet on this market.`,
                        type: 'BET_RESULT',
                        link: `/market/${marketId}`,
                    },
                }));
            }
        }
        // Final: Mark market as resolved
        updates.push(prisma_client_1.default.market.update({
            where: { id: marketId },
            data: {
                status: 'RESOLVED',
                winningOutcomeId,
            },
        }));
        yield prisma_client_1.default.$transaction(updates);
    }
    catch (error) {
        res.status(500).json({ error });
    }
    res
        .status(200)
        .json({ message: 'Market resolved. Bets settled and users notified.' });
}));
exports.resolveMarket2 = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketId, winningOutcomeId } = req.body;
    if (!marketId || !winningOutcomeId) {
        res.status(400).json({ message: 'Missing marketId or winningOutcomeId.' });
        return;
    }
    // Fetch market and outcomes (with bets)
    const market = yield prisma_client_1.default.market.findUnique({
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
    const participantScores = {};
    const notifications = [];
    for (const bet of allBets) {
        const isWinner = bet.outcomeId === winningOutcomeId;
        if (isWinner) {
            const payout = Math.floor(bet.potentialPayout || 0);
            updates.push(prisma_client_1.default.bet.update({
                where: { id: bet.id },
                data: { status: 'WON' },
            }), prisma_client_1.default.user.update({
                where: { id: bet.userId },
                data: { points: { increment: payout } },
            }), prisma_client_1.default.transaction.create({
                data: {
                    userId: bet.userId,
                    amount: payout,
                    type: 'BET_WON',
                    transactionId: bet.id,
                },
            }));
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
        }
        else {
            updates.push(prisma_client_1.default.bet.update({
                where: { id: bet.id },
                data: { status: 'LOST' },
            }));
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
    updates.push(prisma_client_1.default.market.update({
        where: { id: marketId },
        data: {
            status: 'RESOLVED',
            winningOutcomeId,
            resolvedAt: new Date(),
        },
    }));
    // Update tournament participant scores
    for (const key in participantScores) {
        const [tournamentId, userId] = key.split(':');
        const score = participantScores[key];
        updates.push(prisma_client_1.default.tournamentParticipant.updateMany({
            where: {
                tournamentId,
                userId,
            },
            data: {
                score: {
                    increment: score,
                },
            },
        }));
    }
    // Send notifications (outside the transaction)
    yield prisma_client_1.default.$transaction(updates);
    yield Promise.all(notifications.map((n) => prisma_client_1.default.notification.create({ data: n })));
    res.status(200).json({
        message: 'Market resolved. Bets settled, points updated, and tournament scores tracked.',
    });
}));
// GET MARKETS
exports.getMarketsWithStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status;
    const marketType = req.query.marketType;
    const playerId = req.query.playerId;
    const skip = (page - 1) * limit;
    // Dynamic filters
    const where = {
        AND: [
            search
                ? {
                    title: {
                        contains: search,
                        mode: client_1.Prisma.QueryMode.insensitive,
                    },
                }
                : {},
            status ? { status: status } : {},
            marketType ? { marketType: marketType } : {},
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
    const markets = yield prisma_client_1.default.market.findMany({
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
    // markets with odd
    const enhancedMarkets = markets.map((market) => {
        const outcomesWithOdds = (0, calculate_odds_1.calculateOdds)(market.outcomes);
        return Object.assign(Object.assign({}, market), { outcomes: outcomesWithOdds });
    });
    // 2. Total Markets
    const totalMarkets = yield prisma_client_1.default.market.count({ where });
    // 3. Weekly growth stats
    const now = new Date();
    const startOfThisWeek = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 });
    const startOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 7);
    const endOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 1);
    const thisWeekCount = yield prisma_client_1.default.market.count({
        where: {
            createdAt: {
                gte: startOfThisWeek,
            },
        },
    });
    const lastWeekCount = yield prisma_client_1.default.market.count({
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
    // 4. Markets created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = yield prisma_client_1.default.market.count({
        where: {
            createdAt: {
                gte: today,
            },
        },
    });
    res.status(200).json({
        markets: enhancedMarkets,
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
}));
// Get markets with no stats
exports.getMarkets = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status;
    const marketType = req.query.marketType;
    const playerId = req.query.playerId;
    const skip = (page - 1) * limit;
    // Dynamic filters
    const where = {
        AND: [
            search
                ? {
                    title: {
                        contains: search,
                        mode: client_1.Prisma.QueryMode.insensitive,
                    },
                }
                : {},
            status ? { status: status } : {},
            marketType ? { marketType: marketType } : {},
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
    const markets = yield prisma_client_1.default.market.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            title: true,
            description: true,
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
            Match: {
                select: {
                    title: true,
                    description: true,
                    teamA: {
                        select: {
                            name: true,
                            logo: true,
                        },
                    },
                    teamB: {
                        select: {
                            name: true,
                            logo: true,
                        },
                    },
                    startsAt: true,
                    endsAt: true,
                    category: true,
                },
            },
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
            tournaments: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    prizePool: true,
                    entryType: true,
                    _count: {
                        select: {
                            participants: true,
                        },
                    },
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
    });
    // markets with odd
    const enhancedMarkets = markets.map((market) => {
        const outcomesWithOdds = (0, calculate_odds_1.calculateOdds)(market.outcomes);
        return Object.assign(Object.assign({}, market), { outcomes: outcomesWithOdds });
    });
    // 2. Total Markets
    const totalMarkets = yield prisma_client_1.default.market.count({ where });
    res.status(200).json({
        markets: enhancedMarkets,
        pagination: {
            total: totalMarkets,
            page,
            limit,
        },
    });
}));
