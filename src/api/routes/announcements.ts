import express from 'express';
import {
  addAnnouncements,
  getAnnouncements,
} from '../controller/announcements';

const router = express.Router();

router.route('/').post(addAnnouncements);
router.route('/').get(getAnnouncements);

export default router;
