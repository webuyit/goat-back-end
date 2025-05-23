"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vaultsController_1 = require("../controller/vaultsController");
const router = express_1.default.Router();
router.route("/get-vaults").get(vaultsController_1.getVaults);
exports.default = router;
