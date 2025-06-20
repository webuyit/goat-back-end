import express from 'express';
import {
  bulkCreatePlayerStats,
  createPlayerStat,
  getPlayerById,
  getPlayersWithBasicInfo,
  getPlayersWithStats,
  registerPlayer,
  registerPlayerWithTeamAndNationality,
} from '../controller/players';

const router = express.Router();

router.route('/').post(registerPlayer);
router.route('/').get(getPlayersWithStats);
router.route('/player/:id').get(getPlayerById);
router.route('/basic').get(getPlayersWithBasicInfo);
router.route('/player-stats').post(createPlayerStat);
router.route('/player-stats/bulk').post(bulkCreatePlayerStats);

export default router;
