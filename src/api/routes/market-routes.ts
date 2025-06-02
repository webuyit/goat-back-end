import express from 'express';
import {
  createInHouseMarket,
  createSponsoredMarket,
  getMarketsWithStats,
  resolveMarket,
} from '../controller/markets';

const router = express.Router();

router.route('/').post(createInHouseMarket);
router.route('/resolve').patch(resolveMarket);
router.route('/sponsored').post(createSponsoredMarket);
router.route('/').get(getMarketsWithStats);

export default router;
