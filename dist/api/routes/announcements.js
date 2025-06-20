"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const announcements_1 = require("../controller/announcements");
const router = express_1.default.Router();
router.route('/').post(announcements_1.addAnnouncements);
router.route('/').get(announcements_1.getAnnouncements);
exports.default = router;
