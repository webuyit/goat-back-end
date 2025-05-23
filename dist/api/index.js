"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const vaults_1 = __importDefault(require("./routes/vaults"));
const tokensRoute_1 = __importDefault(require("./routes/tokensRoute"));
const poolsRotes_1 = __importDefault(require("./routes/poolsRotes"));
const marketsRoute_1 = __importDefault(require("./routes/marketsRoute"));
const vaults_2 = __importDefault(require("./routes/vaults"));
const testRote_1 = __importDefault(require("./routes/testRote"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const cron_controller_1 = require("./controller/cron-controller");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// ✅ Enable CORS for all routes
app.use((0, cors_1.default)());
app.get("/", (req, res) => {
    res.status(200).send("Hello world kabuguuuu");
});
app.use("/api/v1", vaults_1.default);
app.use("/api/v1/tokens", tokensRoute_1.default);
app.use("/api/v1/pools", poolsRotes_1.default);
app.use("/api/v1/markets", marketsRoute_1.default);
app.use("/api/v1/vaults", vaults_2.default);
app.use("/api/v1/cron", cron_controller_1.cronOnchainUpdates);
app.use("/api/v1/test", testRote_1.default);
// Schedule the cron job to run every 15 minutes
node_cron_1.default.schedule('*/15 * * * *', () => {
    console.log("I invoked at", Date.now());
    (0, cron_controller_1.cronOnchainUpdates)();
});
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
