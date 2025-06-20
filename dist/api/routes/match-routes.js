"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const match_1 = require("../controller/match");
const router = express_1.default.Router();
router.route('/').post(match_1.createMatch);
router.route('/').get(match_1.getMatches);
router.route('/:id').put(match_1.updateMatch);
exports.default = router;
