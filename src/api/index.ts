import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/user-routes';
import playerRoutes from './routes/player-routes';
import marketRoutes from './routes/market-routes';
import betRoutes from './routes/bet-routes';
import announcementsRoute from './routes/announcements';
import rewardRoutes from './routes/rewardRoutes';
import tournamentRoute from './routes/tournamentRoutes';
import matchRoutes from './routes/match-routes';
import cors from 'cors';
import cron from 'node-cron';
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;
app.use(express.json());
// ✅ Enable CORS for all routes
//app.use(cors());

app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'https://app.mygoat.fun',
      'http://localhost:3000',
      'https://goat-app-dashboard.vercel.app',
    ],
    //credentials: true, // 👈 this part
  }),
);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('GOAT');
});

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/markets', marketRoutes);
app.use('/api/v1/bets', betRoutes);
app.use('/api/v1/announcements', announcementsRoute);
app.use('/api/v1/rewards', rewardRoutes);
app.use('/api/v1/tournaments', tournamentRoute);
app.use('/api/v1/matches', matchRoutes);

// Schedule the cron job to run every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('I invoked at', Date.now());
  // cronOnchainUpdates();
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
