import express from 'express';
import { getUser, getUsersWithStats, registerUser } from '../controller/users';

const router = express.Router();

router.route('/register').post(registerUser);
router.route('/').get(getUsersWithStats);
router.route('/user').get(getUser);

export default router;
