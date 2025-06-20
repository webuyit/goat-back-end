"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rewards_1 = require("../controller/rewards");
const router = express_1.default.Router();
router.route('/:userId/reward/rewardId').patch(rewards_1.claimReward);
router.route('/:userId').get(rewards_1.getSingleReward);
exports.default = router;
