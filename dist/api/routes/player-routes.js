"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const players_1 = require("../controller/players");
const router = express_1.default.Router();
router.route('/').post(players_1.registerPlayer);
router.route('/').get(players_1.getPlayersWithStats);
router.route('/player/:id').get(players_1.getPlayerById);
router.route('/basic').get(players_1.getPlayersWithBasicInfo);
router.route('/player-stats').post(players_1.createPlayerStat);
router.route('/player-stats/bulk').post(players_1.bulkCreatePlayerStats);
exports.default = router;
