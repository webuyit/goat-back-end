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
exports.testGetLtv = void 0;
const constants_1 = require("../lib/constants");
const ethers_1 = require("ethers");
const lens_json_1 = __importDefault(require("../abis/lens.json"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
// Create an Ethers provider
const provider = new ethers_1.ethers.providers.JsonRpcProvider(constants_1.RPC_URL);
exports.testGetLtv = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const siloLens = new ethers_1.ethers.Contract(constants_1.SILO_LENS, lens_json_1.default, provider);
    try {
        const liquidityData = yield siloLens.getRawLiquidity("0x396922EF30Cf012973343f7174db850c7D265278");
        const availableToBorrow = parseFloat(ethers_1.ethers.utils.formatUnits(liquidityData, 18));
        // Format with commas and rounded to 2 decimal places
        const readableBorrowAmount = availableToBorrow.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        res.status(200).json({ availableToBorrow });
    }
    catch (error) {
        res.status(400).json({
            error
        });
    }
}));
