"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tournaments_1 = require("../controller/tournaments");
const router = express_1.default.Router();
router.route('/').post(tournaments_1.createTournament);
router.route('/').get(tournaments_1.getTournaments);
router.route('/resolve').patch(tournaments_1.resolveTournament);
router.route('/join').post(tournaments_1.joinTournament);
router.route('/leaderboard/:id').get(tournaments_1.getTournamentLeaderboard);
router.route('/participants').get(tournaments_1.getTournamentParticipants);
exports.default = router;
