import express from "express";

import {
  login,
  logout,
  getMe,
  createUser,
} from "../controllers/auth.controller.js";
import {
  createUserSchema,
  loginUserSchema,
} from "../validators/auth.schema.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/RBACMiddleware.js";

const router = express.Router();

router.post(
  "/create",
  authMiddleware,
  authorize("ADMIN"),
  validate(createUserSchema),
  createUser,
);
router.post("/login", validate(loginUserSchema), login);
router.get("/me", authMiddleware, getMe);
router.post("/logout", authMiddleware, logout);

export default router;
