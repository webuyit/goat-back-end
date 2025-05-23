"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const marketsController_1 = require("../controller/marketsController");
const router = express_1.default.Router();
router.route("/get-markets").get(marketsController_1.getMarkets);
router.route("/silo/rewards").get(marketsController_1.getSiloRewards);
exports.default = router;
