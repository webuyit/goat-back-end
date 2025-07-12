import express from 'express';
import {
  addWalletToUser,
  earlyAccessChecker,
  generateCodesController,
  getUser,
  getUserStats,
  getUsersWithStats,
  getUserTransactions,
  registerUser,
  submitCodeController,
} from '../controller/users';

const router = express.Router();

router.route('/register').post(registerUser);
router.route('/submit-code').post(submitCodeController);
router.route('/generate-code').post(generateCodesController);
router.route('/wallets').post(addWalletToUser);
router.route('/').get(getUsersWithStats);
router.route('/user').get(getUser);
router.route('/early-access').get(earlyAccessChecker);
router.route('/user/basic').get(getUserStats);
router.route('/transactions/user').get(getUserTransactions);

export default router;
