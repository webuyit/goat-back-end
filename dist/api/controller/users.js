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
exports.getUserStats = exports.getUser = exports.getUsersWithStats = exports.registerUser = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
const generateRefferalCode_1 = require("../lib/generateRefferalCode");
const date_fns_1 = require("date-fns");
const client_1 = require("@prisma/client");
exports.registerUser = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { privyId, clerkId, referredByCode, fullName, email, firstName, lastName, username, publicKey, walletSource, authMethod, profilePicture, } = req.body;
    if (!privyId && !clerkId) {
        res.status(400).json({ message: 'Missing auth provider ID.' });
    }
    // Generate a unique referral code
    let referralCode;
    while (true) {
        referralCode = (0, generateRefferalCode_1.generateReferralCode)(); // You can change the length/logic
        const exists = yield prisma_client_1.default.user.findUnique({ where: { referralCode } });
        if (!exists)
            break;
    }
    let referredByUserId;
    if (referredByCode) {
        const referredByUser = yield prisma_client_1.default.user.findUnique({
            where: { referralCode: referredByCode },
        });
        if (!referredByUser) {
            res.status(400).json({ message: 'Invalid referral code.' });
        }
        referredByUserId = referredByUser.id;
    }
    // CHECK IF EMAIL IS AVAILABLE
    const existingUser = yield prisma_client_1.default.user.findUnique({
        where: { privyId }, // assuming `email` is unique in DB schema
    });
    console.log('already create an account', existingUser);
    if (existingUser) {
        res.status(200).json({
            message: 'User already exists. Linking current session.',
            userId: existingUser.id,
            referralCode: existingUser.referralCode,
        });
        return;
    }
    // Create the user
    const newUser = yield prisma_client_1.default.user.create({
        data: {
            privyId,
            clerkId,
            referralCode,
            referredById: referredByUserId,
            fullName,
            firstName,
            lastName,
            email,
            username,
            authMethod,
            profilePicture,
            // All other fields left empty for now (onboarding)
            wallets: {
                create: {
                    walletSource,
                    publicKey,
                    name: walletSource,
                },
            },
        },
    });
    console.log('Registered user ', newUser);
    // Register wallet
    res.status(201).json({
        message: 'User registered successfully.',
        userId: newUser.id,
        referralCode: newUser.referralCode,
    });
}));
// Get users
exports.getUsersWithStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;
    // Filtering logic
    const where = search
        ? {
            OR: [
                {
                    username: { contains: search, mode: client_1.Prisma.QueryMode.insensitive },
                },
                {
                    fullName: { contains: search, mode: client_1.Prisma.QueryMode.insensitive },
                },
            ],
        }
        : {};
    // 1. Paginated users
    const users = yield prisma_client_1.default.user.findMany({
        where,
        skip,
        take: limit,
        select: {
            id: true,
            faucetPoints: true,
            fullName: true,
            firstName: true,
            lastName: true,
            points: true,
            phone: true,
            profilePicture: true,
            createdAt: true,
            earlyAccess: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    // 2. Total count
    const totalUsers = yield prisma_client_1.default.user.count();
    // 3. Weekly growth comparison
    const now = new Date();
    const startOfThisWeek = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 });
    const startOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 7);
    const endOfLastWeek = (0, date_fns_1.subDays)(startOfThisWeek, 1);
    const thisWeekCount = yield prisma_client_1.default.user.count({
        where: {
            createdAt: {
                gte: startOfThisWeek,
            },
        },
    });
    const lastWeekCount = yield prisma_client_1.default.user.count({
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
    // 4. Users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = yield prisma_client_1.default.user.count({
        where: {
            createdAt: {
                gte: today,
            },
        },
    });
    res.status(200).json({
        users,
        pagination: {
            total: totalUsers,
            page,
            limit,
        },
        stats: {
            totalUsers,
            newUsersThisWeek: thisWeekCount,
            newUsersLastWeek: lastWeekCount,
            growthPercent: Math.round(growthPercent * 100) / 100, // round to 2 decimal places
            usersToday: todayCount,
        },
    });
}));
exports.getUser = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, privyId, email } = req.query;
    if (!userId && !privyId && !email) {
        res.status(400).json({
            message: 'Provide at least one filter: userId, privyId, or email.',
        });
        return;
    }
    const user = yield prisma_client_1.default.user.findFirst({
        where: Object.assign(Object.assign(Object.assign({}, (userId && { id: String(userId) })), (privyId && { privyId: String(privyId) })), (email && { email: String(email).toLowerCase() })),
        include: {
            wallets: {
                select: {
                    walletSource: true,
                    name: true,
                    publicKey: true,
                    active: true,
                },
            },
            bets: {},
            // Add includes like referral info if needed
        },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({
        message: 'User found.',
        user,
    });
}));
exports.getUserStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, privyId, email } = req.query;
    if (!userId && !privyId && !email) {
        res.status(400).json({
            message: 'Provide at least one filter: userId, privyId, or email.',
        });
        return;
    }
    const user = yield prisma_client_1.default.user.findFirst({
        where: Object.assign(Object.assign(Object.assign({}, (userId && { id: String(userId) })), (privyId && { privyId: String(privyId) })), (email && { email: String(email).toLowerCase() })),
        include: {
            wallets: {
                select: {
                    walletSource: true,
                    name: true,
                    publicKey: true,
                    active: true,
                },
            },
        },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found.' });
    }
    const [betsCount, unreadNotifications] = yield Promise.all([
        prisma_client_1.default.bet.count({ where: { userId: user.id } }),
        prisma_client_1.default.notification.count({ where: { userId: user.id, read: false } }),
    ]);
    res.status(200).json({
        user,
        stats: {
            betsCount,
            unreadNotifications,
        },
    });
}));
