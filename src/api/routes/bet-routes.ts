import express from 'express';
import {
  getBetsWithStats,
  getMarketOdds,
  getUserBetsCategorized,
  placeBet2,
} from '../controller/bet';

const router = express.Router();

router.route('/').post(placeBet2);
router.route('/').get(getBetsWithStats);
router.route('/user').get(getUserBetsCategorized);
router.route('/:marketId/odds').get(getMarketOdds);

export default router;
