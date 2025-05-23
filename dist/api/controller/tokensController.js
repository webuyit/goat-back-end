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
exports.getTokens = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
exports.getTokens = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query;
    const filters = {};
    if (query.symbol) {
        filters.symbol = query.symbol;
    }
    if (query.aprBorrowMin || query.aprBorrowMax) {
        filters.silos = { some: { aprBorrow: {} } };
        if (query.aprBorrowMin)
            filters.silos.some.aprBorrow.gte = Number(query.aprBorrowMin);
        if (query.aprBorrowMax)
            filters.silos.some.aprBorrow.lte = Number(query.aprBorrowMax);
    }
    if (query.aprDepositMin || query.aprDepositMax) {
        filters.silos = { some: { aprDeposit: {} } };
        if (query.aprDepositMin)
            filters.silos.some.aprDeposit.gte = Number(query.aprDepositMin);
        if (query.aprDepositMax)
            filters.silos.some.aprDeposit.lte = Number(query.aprDepositMax);
    }
    if (query.tvlMin || query.tvlMax) {
        filters.silos = { some: { tvl: {} } }; // 👈 Ensure we filter within the related Silos
        if (query.tvlMin)
            filters.silos.some.tvl.gte = Number(query.tvlMin);
        if (query.tvlMax)
            filters.silos.some.tvl.lte = Number(query.tvlMax);
    }
    try {
        const items = yield prisma_client_1.default.token.findMany({
            where: filters,
            include: {
                silos: {
                    select: {
                        aprDeposit: true,
                        aprBorrow: true,
                        name: true,
                        siloAddress: true
                    }
                }
            }
        });
        res.status(200).json({ data: { items } });
    }
    catch (error) {
        res.status(400).json(error);
    }
}));
