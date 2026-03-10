import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { chatResponse } from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/", chatResponse);

export default router;
