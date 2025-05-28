import express from 'express';
import { getUsersWithStats, registerUser } from '../controller/users';

const router = express.Router();

router.route('/').post(registerUser);
router.route('/').get(getUsersWithStats);

export default router;
