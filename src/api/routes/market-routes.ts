import express from 'express';
import {
  createInHouseMarket,
  createSponsoredMarket,
  getMarketsWithStats,
} from '../controller/markets';

const router = express.Router();

router.route('/').post(createInHouseMarket);
router.route('/sponsored').post(createSponsoredMarket);
router.route('/').get(getMarketsWithStats);

export default router;
