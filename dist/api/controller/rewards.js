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
exports.getSingleReward = exports.getUserRewards = exports.claimReward = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
exports.claimReward = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rewardId, userId } = req.params; // assumed you're using middleware to attach user
    if (!userId || !rewardId) {
        res.status(400).json({ message: 'Missing rewardId or user.' });
        throw new Error('Missing rewardId or user.');
    }
    const reward = yield prisma_client_1.default.reward.findUnique({
        where: { id: rewardId },
    });
    if (!reward) {
        res.status(404).json({ message: 'Reward not found.' });
        throw new Error('Reward not found.');
    }
    if (reward.userId !== userId) {
        res.status(403).json({ message: 'Unauthorized.' });
        throw new Error('Unauthorized claim.');
    }
    if (reward.status === 'CLAIMED') {
        res.status(400).json({ message: 'Reward already claimed.' });
        throw new Error('Already claimed.');
    }
    yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.reward.update({
            where: { id: rewardId },
            data: {
                status: 'CLAIMED',
                claimedAt: new Date(),
            },
        });
        yield tx.user.update({
            where: { id: userId },
            data: {
                points: { increment: reward.amount },
            },
        });
        yield tx.transaction.create({
            data: {
                userId,
                amount: reward.amount,
                type: 'REWARD_CLAIMED',
                transactionId: rewardId,
            },
        });
    }));
    res.status(200).json({ message: 'Reward claimed successfully.' });
}));
exports.getUserRewards = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized.' });
        throw new Error('Unauthorized access.');
    }
    const rewards = yield prisma_client_1.default.reward.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ rewards });
}));
exports.getSingleReward = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rewardId, userId } = req.params;
    if (!userId || !rewardId) {
        res.status(400).json({ message: 'Missing rewardId or user.' });
        throw new Error('Missing rewardId or user.');
    }
    const reward = yield prisma_client_1.default.reward.findUnique({ where: { id: rewardId } });
    if (!reward) {
        res.status(404).json({ message: 'Reward not found.' });
        throw new Error('Reward not found.');
    }
    if (reward.userId !== userId) {
        res.status(403).json({ message: 'Unauthorized.' });
        throw new Error('Unauthorized.');
    }
    res.status(200).json({ reward });
}));
