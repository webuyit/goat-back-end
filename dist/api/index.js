"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const user_routes_1 = __importDefault(require("./routes/user-routes"));
const player_routes_1 = __importDefault(require("./routes/player-routes"));
const market_routes_1 = __importDefault(require("./routes/market-routes"));
const bet_routes_1 = __importDefault(require("./routes/bet-routes"));
const announcements_1 = __importDefault(require("./routes/announcements"));
const rewardRoutes_1 = __importDefault(require("./routes/rewardRoutes"));
const tournamentRoutes_1 = __importDefault(require("./routes/tournamentRoutes"));
const match_routes_1 = __importDefault(require("./routes/match-routes"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 4000;
app.use(express_1.default.json());
// ✅ Enable CORS for all routes
app.use((0, cors_1.default)());
app.get('/', (req, res) => {
    res.status(200).send('Sonic Defi APR/YIELS AND PROTOCOLS DATA AGGREGATOR');
});
app.use('/api/v1/users', user_routes_1.default);
app.use('/api/v1/players', player_routes_1.default);
app.use('/api/v1/markets', market_routes_1.default);
app.use('/api/v1/bets', bet_routes_1.default);
app.use('/api/v1/announcements', announcements_1.default);
app.use('/api/v1/rewards', rewardRoutes_1.default);
app.use('/api/v1/tournaments', tournamentRoutes_1.default);
app.use('/api/v1/matches', match_routes_1.default);
// Schedule the cron job to run every 15 minutes
node_cron_1.default.schedule('*/15 * * * *', () => {
    console.log('I invoked at', Date.now());
    // cronOnchainUpdates();
});
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
