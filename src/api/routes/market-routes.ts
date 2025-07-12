import express from 'express';
import {
  createInHouseMarket,
  createSponsoredMarket,
  getMarkets,
  getMarketsWithStats,
  getPopularMarkets,
  getUpcomingMarkets,
  resolveMarket,
} from '../controller/markets';

const router = express.Router();

router.route('/').post(createInHouseMarket);
router.route('/resolve').patch(resolveMarket);
router.route('/sponsored').post(createSponsoredMarket);
router.route('/').get(getMarketsWithStats);
router.route('/basic').get(getMarkets);
router.route('/popular').get(getPopularMarkets);
router.route('/upcoming').get(getUpcomingMarkets);

export default router;
