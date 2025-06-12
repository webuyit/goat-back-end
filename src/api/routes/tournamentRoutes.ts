import express from 'express';
import {
  createTournament,
  getTournamentLeaderboard,
  getTournamentParticipants,
  getTournaments,
  joinTournament,
  resolveTournament,
} from '../controller/tournaments';

const router = express.Router();

router.route('/').post(createTournament);
router.route('/').get(getTournaments);
router.route('/resolve').patch(resolveTournament);
router.route('/join').post(joinTournament);
router.route('/leaderboard/:id').get(getTournamentLeaderboard);
router.route('/participants').get(getTournamentParticipants);

export default router;
