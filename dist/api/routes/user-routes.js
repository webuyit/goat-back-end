"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const users_1 = require("../controller/users");
const router = express_1.default.Router();
router.route('/register').post(users_1.registerUser);
router.route('/').get(users_1.getUsersWithStats);
router.route('/user').get(users_1.getUser);
router.route('/user/basic').get(users_1.getUserStats);
exports.default = router;
