import express from 'express';
import {
  getUser,
  getUserStats,
  getUsersWithStats,
  registerUser,
} from '../controller/users';

const router = express.Router();

router.route('/register').post(registerUser);
router.route('/').get(getUsersWithStats);
router.route('/user').get(getUser);
router.route('/user/basic').get(getUserStats);

export default router;
