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
exports.getAnnouncements = exports.addAnnouncements = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_client_1 = __importDefault(require("../prisma-client"));
exports.addAnnouncements = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, coverUrl, link, external, themeColor } = req.body;
    if (!title || !link || !coverUrl) {
        res.status(400).json({ message: 'Missing Required parameters' });
    }
    try {
        const newAnnouncement = yield prisma_client_1.default.announcements.create({
            data: {
                title,
                description,
                coverUrl,
                external,
                link,
                themeColor,
            },
        });
        res.status(201).json({
            message: 'New announcment created',
            announcement: newAnnouncement.title,
        });
    }
    catch (error) {
        res.status(500).json({ error });
    }
}));
exports.getAnnouncements = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const announcemnts = yield prisma_client_1.default.announcements.findMany();
        res.status(200).json({
            data: announcemnts,
        });
    }
    catch (error) {
        res.status(500).json({ error });
    }
}));
