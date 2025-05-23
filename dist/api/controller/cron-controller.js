"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronOnchainUpdates = void 0;
const constants_1 = require("../lib/constants");
const ethers_1 = require("ethers");
const lens_json_1 = __importDefault(require("../abis/lens.json"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
// Create an Ethers provider
const provider = new ethers_1.ethers.providers.JsonRpcProvider(constants_1.RPC_URL);
const cronOnchainUpdates = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[cron] Job started at ${new Date().toLocaleString()}`);
    try {
        const silos = yield prisma_client_1.default.silo.findMany();
        const siloLens = new ethers_1.ethers.Contract(constants_1.SILO_LENS, lens_json_1.default, provider);
        const updates = []; // Store updates in batch
        for (let silo of silos) {
            try {
                console.log(`[cron] Fetching data for ${silo.name}`);
                const borrowAPR = yield siloLens.getBorrowAPR(silo.siloAddress);
                const depositAPR = yield siloLens.getDepositAPR(silo.siloAddress);
                const maxLtv = yield siloLens.getMaxLtv(silo.siloAddress);
                const getLoanThreshold = yield siloLens.getLt(silo.siloAddress);
                const getAvailableToborrow = yield siloLens.getRawLiquidity(silo.siloAddress);
                // Format values
                const borrowAPRPercentage = parseFloat(ethers_1.ethers.utils.formatUnits(borrowAPR, 18)) * 100;
                const depositAPRPercentage = parseFloat(ethers_1.ethers.utils.formatUnits(depositAPR, 18)) * 100;
                const maxLtvPercentage = parseFloat(ethers_1.ethers.utils.formatUnits(maxLtv, 18)) * 100;
                const loanThreshouldPercentage = parseFloat(ethers_1.ethers.utils.formatUnits(getLoanThreshold, 18)) * 100;
                const availableToBorrow = parseFloat(ethers_1.ethers.utils.formatUnits(getAvailableToborrow, 18));
                // FIXED VALUES
                const borrowDecimal = parseFloat(borrowAPRPercentage.toFixed(2));
                const depositDecimal = parseFloat(depositAPRPercentage.toFixed(2));
                console.log(`[cron] ${silo.name} | Borrow: ${borrowDecimal} | Deposit: ${depositDecimal} | LTV: ${maxLtvPercentage} | LT: ${loanThreshouldPercentage}`);
                // Store update in batch array
                updates.push(prisma_client_1.default.silo.update({
                    where: { siloAddress: silo.siloAddress },
                    data: {
                        aprBorrow: borrowDecimal,
                        aprDeposit: depositDecimal,
                        liquidationThreshold: loanThreshouldPercentage,
                        ltv: maxLtvPercentage,
                        availableToBorrow: availableToBorrow
                    },
                }));
            }
            catch (error) {
                console.error(`[cron] Error updating ${silo.name}:`, error);
            }
        }
        // Execute batch updates
        yield Promise.all(updates);
        console.log(`[cron] All updates completed successfully.`);
    }
    catch (error) {
        console.error(`[cron] Critical error:`, error);
    }
    finally {
        yield prisma_client_1.default.$disconnect(); // Close Prisma connection
    }
});
exports.cronOnchainUpdates = cronOnchainUpdates;
// LEGACY CODE
/*import { SILO_LENS, RPC_URL } from "../lib/constants"
import  {ethers} from "ethers";
import LENS_ABI from '../abis/lens.json'
import prisma from "../prisma-client";
// Create an Ethers provider
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
function logMessage() {
    console.log('Cron job executed at:', new Date().toLocaleString());
    }

export const cronOnchainUpdates =  async () => {
  const silos =  await prisma.silo.findMany()
   for(let silo of silos){
     console.log("we're running smootly", silo.name)
  
      try {
             // Step 2: Fetch APRs for each market's address
             const siloLens = new ethers.Contract(SILO_LENS, LENS_ABI, provider);
         const borrowAPR = await siloLens.getBorrowAPR(silo.siloAddress);
         const depositAPR = await siloLens.getDepositAPR(silo.siloAddress);
         const maxLtv = await siloLens.getMaxLtv(silo.siloAddress)
         const getLoanThreshould  = await siloLens.getLt(silo.siloAddress)
              // Format values
        const borrowAPRPercentage =
        parseFloat(ethers.utils.formatUnits(borrowAPR, 18)) * 100;
      const depositAPRPercentage =
        parseFloat(ethers.utils.formatUnits(depositAPR, 18)) * 100;
        const maxLtvPercentage =
        parseFloat(ethers.utils.formatUnits(maxLtv, 18)) * 100;
        const loanThreshouldPercentage =
        parseFloat(ethers.utils.formatUnits(getLoanThreshould, 18)) * 100;

        // FIXED VALUES
        const borrowDecimal = parseFloat(borrowAPRPercentage.toFixed(2));
        const depositDecimal = parseFloat(depositAPRPercentage.toFixed(2));
         console.log(`Borrow decimal of ${silo.name} is ${borrowDecimal}`)
         console.log(`Deposit decimal of ${silo.name} is ${depositDecimal}`)
         console.log(`Max ltv big n  of ${silo.name} is ${maxLtvPercentage}`)
         console.log(`Max LT big n  of ${silo.name} is ${loanThreshouldPercentage}`)

            // Update database
        await prisma.silo.update({
            where: { siloAddress: silo.siloAddress },
            data: { aprBorrow: borrowDecimal,
                 aprDeposit: depositDecimal,
                 liquidationThreshold : loanThreshouldPercentage,
                 ltv : maxLtvPercentage
                },
          });
      } catch (error) {
        console.log(error)
      }
   }
   
}*/ 
