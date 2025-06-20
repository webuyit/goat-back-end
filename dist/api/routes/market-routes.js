"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const markets_1 = require("../controller/markets");
const router = express_1.default.Router();
router.route('/').post(markets_1.createInHouseMarket);
router.route('/resolve').patch(markets_1.resolveMarket);
router.route('/sponsored').post(markets_1.createSponsoredMarket);
router.route('/').get(markets_1.getMarketsWithStats);
router.route('/basic').get(markets_1.getMarkets);
exports.default = router;
