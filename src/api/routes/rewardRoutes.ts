import express from 'express';
import { claimReward, getSingleReward } from '../controller/rewards';

const router = express.Router();
router.route('/:userId/reward/rewardId').patch(claimReward);
router.route('/:userId').get(getSingleReward);

export default router;
