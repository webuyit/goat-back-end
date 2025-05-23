import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";

import testRoutes from './routes/testRote'

import cors from "cors";
import cron from "node-cron"
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;

// ✅ Enable CORS for all routes
app.use(cors())
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Sonic Defi APR/YIELS AND PROTOCOLS DATA AGGREGATOR");
});

app.use("/api/v1/test", testRoutes)



  // Schedule the cron job to run every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log("I invoked at", Date.now())
 // cronOnchainUpdates();
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
})