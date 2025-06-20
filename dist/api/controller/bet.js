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
exports.getMarketOdds = exports.getBetsWithStats = exports.placeBet2 = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
const calculate_odds_1 = require("../lib/calculate-odds");
const date_fns_1 = require("date-fns");
const constants_1 = require("../lib/constants");
const fees_calculator_1 = require("../lib/fees-calculator");
exports.placeBet2 = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { userId, outcomeId, amount } = req.body;
    if (!userId || !outcomeId || !amount || amount <= 0) {
        res.status(400).json({ message: 'Invalid bet input.' });
        throw new Error('Invalid bet input');
    }
    // Fast read-only queries
    const [user, outcome] = yield Promise.all([
        prisma_client_1.default.user.findUnique({ where: { id: userId } }),
        prisma_client_1.default.outcome.findUnique({
            where: { id: outcomeId },
            include: { market: true },
        }),
    ]);
    if (!user) {
        res.status(404).json({ message: 'User not found.' });
        throw new Error('User not found.');
    }
    if (!outcome)
        res.status(404).json({ message: 'Outcome not found.' });
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
        const alreadyEntered = yield prisma_client_1.default.bet.findFirst({
            where: { userId, outcome: { marketId: market.id } },
        });
        if (!alreadyEntered) {
            yield prisma_client_1.default.user.update({
                where: { id: userId },
                data: { faucetPoints: { decrement: market.entryFee } },
            });
            yield prisma_client_1.default.platformRevenue.create({
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
    const allOutcomes = yield prisma_client_1.default.outcome.findMany({
        where: { marketId: outcome.marketId },
    });
    const oddsArray = (0, calculate_odds_1.calculateOdds)(allOutcomes);
    const selectedOdds = oddsArray.find((o) => o.id === outcomeId);
    const oddsAtBet = (_a = selectedOdds === null || selectedOdds === void 0 ? void 0 : selectedOdds.odds) !== null && _a !== void 0 ? _a : 1;
    // const feeAmount = Math.floor(amount * BETTING_PLATFORM_FEE);
    const feeAmount = Math.max(1, Math.round(amount * constants_1.BETTING_PLATFORM_FEE));
    // Count user bets BEFORE transaction
    const userBetCount = yield prisma_client_1.default.bet.count({ where: { userId } });
    const referrerId = user.referredById;
    const { referralShare, sponsorShare, platformNetFee } = (0, fees_calculator_1.calculateFeeBreakdown)({
        feeAmount,
        isSponsored: outcome.market.marketType === 'SPONSORED',
        hasReferrer: Boolean(referrerId),
        userBetCount,
        referralShareRatio: constants_1.REFFERAL_FEE_SHARE,
        sponsorShareRatio: constants_1.SPONSOR_FEE_SHARE,
    });
    let placedBet;
    //let referralShare = 0;
    //let finalSponsorShare = 0;
    const notifications = [];
    yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const existingBet = yield tx.bet.findFirst({
            where: { userId, outcomeId },
        });
        // Deduct balance
        yield tx.user.update({
            where: { id: userId },
            data: { faucetPoints: { decrement: amount } },
        });
        // Place the bet
        placedBet = yield tx.bet.create({
            data: {
                userId,
                outcomeId,
                amount,
                oddsAtBet,
                potentialPayout: Math.floor(amount * oddsAtBet),
                status: 'PENDING',
                fee: feeAmount,
            },
        });
        // Update outcome and market pools
        yield tx.outcome.update({
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
        yield tx.transaction.create({
            data: {
                userId,
                amount,
                type: 'BET_PLACED',
                transactionId: placedBet.id,
            },
        });
        // GET PLATFORM REVENUE
        yield tx.platformRevenue.create({
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
                yield tx.reward.create({
                    data: {
                        userId: referrerId,
                        amount: referralShare,
                        type: 'REFERRAL',
                        source: isSponsored ? 'SPONSORED_MARKET' : 'UNSPONSORED_MARKET',
                        betId: placedBet.id,
                    },
                });
                yield tx.referralEarning.create({
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
                yield tx.reward.create({
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
        }
        else {
            if (referrerId && userBetCount < 10) {
                //referralShare = Math.floor(feeAmount * REFFERAL_FEE_SHARE);
                /* await tx.user.update({
                  where: { id: referrerId },
                  data: { points: { increment: referralShare } },
                });*/
                yield tx.reward.create({
                    data: {
                        userId: referrerId,
                        amount: referralShare,
                        type: 'REFERRAL',
                        source: isSponsored ? 'SPONSORED_MARKET' : 'UNSPONSORED_MARKET',
                        betId: placedBet.id,
                    },
                });
                yield tx.referralEarning.create({
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
    }));
    // 🔥 Notifications outside transaction
    yield Promise.all(notifications.map((note) => prisma_client_1.default.notification.create({ data: note })));
    res.status(201).json({
        message: 'Bet placed successfully.',
        bet: placedBet,
        odds: oddsAtBet,
        impliedProbability: (_b = selectedOdds === null || selectedOdds === void 0 ? void 0 : selectedOdds.impliedProbability) !== null && _b !== void 0 ? _b : null,
    });
}));
exports.getBetsWithStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const outcomeId = req.query.outcomeId || '';
    const skip = (page - 1) * limit;
    // Build filter condition
    const where = Object.assign(Object.assign(Object.assign({}, (status ? { status: status } : {})), (outcomeId ? { outcomeId } : {})), (search
        ? {
            user: {
                fullName: {
                    contains: search,
                    mode: 'insensitive',
                },
            },
        }
        : {}));
    // 1. Bets list with pagination
    const bets = yield prisma_client_1.default.bet.findMany({
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
    const totalBets = yield prisma_client_1.default.bet.count({ where });
    // 3. Total amount staked
    const totalAmountStaked = yield prisma_client_1.default.bet.aggregate({
        where,
        _sum: {
            amount: true,
        },
    });
    // 4. Growth Stats
    const now = new Date();
    const startOfThisWeek = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 });
    const startOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 7);
    const endOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 1);
    const thisWeekCount = yield prisma_client_1.default.bet.count({
        where: {
            createdAt: {
                gte: startOfThisWeek,
            },
        },
    });
    const lastWeekCount = yield prisma_client_1.default.bet.count({
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
    // 5. Today's Bets
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = yield prisma_client_1.default.bet.count({
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
}));
// GET ODDS
exports.getMarketOdds = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketId } = req.params;
    const { selectedOutcomeId, userAmount } = req.query;
    if (!marketId) {
        res.status(400).json({ message: 'Market ID is required.' });
    }
    const outcomes = yield prisma_client_1.default.outcome.findMany({
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
    const oddsData = (0, calculate_odds_1.calculateOdds)(outcomes);
    let potentialPayout = null;
    if (selectedOutcomeId && userAmount) {
        const selected = oddsData.find((o) => o.id === selectedOutcomeId);
        if (selected) {
            const userAmountNumber = parseFloat(userAmount);
            if (!isNaN(userAmountNumber) && userAmountNumber > 0) {
                potentialPayout = parseFloat((selected.odds * userAmountNumber).toFixed(2));
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
}));
