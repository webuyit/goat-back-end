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
exports.getVaults = void 0;
//import expressAsyncHandler from "express-async-handler"
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
const formatNameQuery_1 = require("../lib/formatNameQuery");
exports.getVaults = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query;
    const filters = {};
    // Market Filtering
    if (query.vaultName) {
        filters.name = { contains: query.vaultName, mode: 'insensitive' };
    }
    // Filter by platform name
    if (query.platformName) {
        const formattedPlatformName = (0, formatNameQuery_1.formatPlatformName)(query.platformName);
        filters.platform = { name: { contains: formattedPlatformName, mode: 'insensitive' } };
    }
    if (query.token0Symbol) {
        filters.token0 = { symbol: query.token0Symbol };
    }
    try {
        const items = yield prisma_client_1.default.vault.findMany({
            where: filters,
            include: {
                platform: {
                    select: {
                        name: true
                    }
                },
                token0: {
                    select: {
                        name: true,
                        symbol: true,
                        logo: true,
                        tokenAddress: true
                    }
                },
                token1: {
                    select: {
                        name: true,
                        symbol: true,
                        logo: true,
                        tokenAddress: true
                    }
                },
            }
        });
        res.status(200).json({
            data: { items }
        });
    }
    catch (error) {
        res.status(400).json(error);
    }
}));
