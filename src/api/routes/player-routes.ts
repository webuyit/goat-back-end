import express from 'express';
import {
  getPlayersWithStats,
  registerPlayer,
  registerPlayerWithTeamAndNationality,
} from '../controller/players';

const router = express.Router();

router.route('/').post(registerPlayer);
router.route('/').get(getPlayersWithStats);

export default router;
