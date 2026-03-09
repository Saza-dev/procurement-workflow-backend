import express from "express";
import { authMiddleware } from "../../../../procurement/backend/src/middleware/authMiddleware.js";
import {
  makeApprovalDecision,
  viewBasketApprovals,
  viewBaskets,
} from "../controllers/approval.controller.js";
import { approvalDecisionSchema } from "../validators/approval.schema.js";
import { validate } from "../middleware/validate.js";
import { authorize } from "../middleware/RBACMiddleware.js";

const router = express.Router();

// approve / reject basket with comments
router.post(
  "/decision",
  authMiddleware,
  authorize("ADMIN, CEO, FM, OM"),
  validate(approvalDecisionSchema),
  makeApprovalDecision,
);

// show what to approve
router.get(
  "/view",
  authMiddleware,
  authorize("ADMIN, CEO, FM, OM"),
  viewBaskets,
);
//  show approves for basket Id
router.get(
  "/view-by-id",
  authMiddleware,
  authorize("ADMIN, CEO, PE, FM, OM, DH"),
  viewBasketApprovals,
);

export default router;
