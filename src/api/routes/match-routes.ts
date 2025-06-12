import express from 'express';
import { createMatch, getMatches, updateMatch } from '../controller/match';

const router = express.Router();

router.route('/').post(createMatch);
router.route('/').get(getMatches);
router.route('/:id').put(updateMatch);

export default router;
