"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const poolsController_1 = require("../controller/poolsController");
const router = express_1.default.Router();
router.route("/get-pools").get(poolsController_1.getPools);
exports.default = router;
