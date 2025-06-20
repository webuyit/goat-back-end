"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bet_1 = require("../controller/bet");
const router = express_1.default.Router();
router.route('/').post(bet_1.placeBet2);
router.route('/').get(bet_1.getBetsWithStats);
router.route('/:marketId/odds').get(bet_1.getMarketOdds);
exports.default = router;
