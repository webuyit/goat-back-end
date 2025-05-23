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
exports.getPools = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
exports.getPools = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query;
    const filters = {};
    // Token Filtering
    if (query.tokenSymbol) {
        filters.token = { symbol: query.tokenSymbol };
    }
    // APR Borrow Filters
    if (query.aprBorrowMin || query.aprBorrowMax) {
        filters.aprBorrow = {};
        if (query.aprBorrowMin)
            filters.aprBorrow.gte = Number(query.aprBorrowMin);
        if (query.aprBorrowMax)
            filters.aprBorrow.lte = Number(query.aprBorrowMax);
    }
    // APR Deposit Filters
    if (query.aprDepositMin || query.aprDepositMax) {
        filters.aprDeposit = {};
        if (query.aprDepositMin)
            filters.aprDeposit.gte = Number(query.aprDepositMin);
        if (query.aprDepositMax)
            filters.aprDeposit.lte = Number(query.aprDepositMax);
    }
    // TVL Filters
    if (query.tvlMin || query.tvlMax) {
        filters.tvl = {};
        if (query.tvlMin)
            filters.tvl.gte = Number(query.tvlMin);
        if (query.tvlMax)
            filters.tvl.lte = Number(query.tvlMax);
    }
    // Utilization Filters
    if (query.utilizationMin || query.utilizationMax) {
        filters.utilization = {};
        if (query.utilizationMin)
            filters.utilization.gte = Number(query.utilizationMin);
        if (query.utilizationMax)
            filters.utilization.lte = Number(query.utilizationMax);
    }
    // Risk Level Filter
    if (query.riskLevel) {
        filters.riskLevel = query.riskLevel.toUpperCase();
    }
    // LTV Filters
    if (query.ltvMin || query.ltvMax) {
        filters.ltv = {};
        if (query.ltvMin)
            filters.ltv.gte = Number(query.ltvMin);
        if (query.ltvMax)
            filters.ltv.lte = Number(query.ltvMax);
    }
    // Liquidation Threshold Filters
    if (query.liquidationThresholdMin || query.liquidationThresholdMax) {
        filters.liquidationThreshold = {};
        if (query.liquidationThresholdMin)
            filters.liquidationThreshold.gte = Number(query.liquidationThresholdMin);
        if (query.liquidationThresholdMax)
            filters.liquidationThreshold.lte = Number(query.liquidationThresholdMax);
    }
    // Available to Borrow Filters
    if (query.availableToBorrowMin || query.availableToBorrowMax) {
        filters.availableToBorrow = {};
        if (query.availableToBorrowMin)
            filters.availableToBorrow.gte = Number(query.availableToBorrowMin);
        if (query.availableToBorrowMax)
            filters.availableToBorrow.lte = Number(query.availableToBorrowMax);
    }
    // Platform Filter
    if (query.platformId) {
        filters.platformId = query.platformId;
    }
    // Market Filters
    if (query.marketBaseSymbol || query.marketBridgeSymbol) {
        filters.marketBase = { symbol: query.marketBaseSymbol };
        filters.marketBridge = { symbol: query.marketBridgeSymbol };
    }
    // Sorting Logic
    const orderBy = {};
    if (query.sortBy && query.orderBy) {
        orderBy[query.sortBy] = query.orderBy === 'asc' ? 'asc' : 'desc';
    }
    // Pagination Logic
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    try {
        // Query the database
        const silos = yield prisma_client_1.default.silo.findMany({
            where: filters,
            include: {
                token: { select: { symbol: true, name: true, tokenAddress: true } },
                marketBase: { select: { name: true, } },
                marketBridge: { select: { name: true } },
            },
            orderBy,
            skip,
            take: limit,
        });
        // Count total items for pagination
        const totalSilos = yield prisma_client_1.default.silo.count({ where: filters });
        res.status(200).json({
            data: silos,
            meta: {
                totalSilos,
                page,
                totalPages: Math.ceil(totalSilos / limit),
                limit,
            },
        });
    }
    catch (error) {
        res.status(400).json(error);
    }
}));
