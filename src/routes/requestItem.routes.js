import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  addInvoice,
  addItem,
  addQuotation,
  removeItem,
  splitAndMarkDamaged,
  TagItem,
  updateItem,
  updateItemCondition,
  viewItemsByBasketId,
  viewItemsByCondition,
  viewUserItemsByCondition,
  warehouseCheck,
} from "../controllers/requestItem.controller.js";
import {
  addItemSchema,
  invoiceSchema,
  markDamagedSchema,
  patchItemSchema,
  quotationSchema,
  tagItemSchema,
  warehouseSchema,
} from "../validators/requestItem.schema.js";
import { validate } from "../middleware/validate.js";
import { authorize } from "../middleware/RBACMiddleware.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// add items to basket
router.post(
  "/add/:basketId",
  authMiddleware,
  authorize("DH, ADMIN"),
  validate(addItemSchema),
  addItem,
);

// view items by basket Id
router.get(
  "/view-all/:basketId",
  authMiddleware,
  authorize("DH, ADMIN, CEO, PE, FM, OM, HR"),
  viewItemsByBasketId,
);

// edit items
router.patch(
  "/update/:basketId/:itemId",
  authMiddleware,
  authorize("DH, ADMIN"),
  validate(patchItemSchema),
  updateItem,
);

// delete items from basket
router.delete(
  "/remove/:basketId/:itemId",
  authMiddleware,
  authorize("DH, ADMIN"),
  removeItem,
);

// mark damage items
router.post(
  "/mark-damaged",
  authMiddleware,
  authorize("DH, ADMIN"),
  validate(markDamagedSchema),
  splitAndMarkDamaged,
);

// update damage status to good
router.patch(
  "/:itemId/condition",
  authMiddleware,
  authorize("PE,ADMIN"),
  updateItemCondition,
);

// view items by condition
router.get(
  "/view/:condition",
  authMiddleware,
  authorize("DH, PE, ADMIN"),
  viewItemsByCondition,
);

// view items by condition and user ID
router.get(
  "/view/:condition/:userId",
  authMiddleware,
  authorize("DH, ADMIN"),
  viewUserItemsByCondition,
);

// warehouse check
router.post(
  "/warehouse",
  authMiddleware,
  authorize("ADMIN, PE"),
  validate(warehouseSchema),
  warehouseCheck,
);

// add qutation
router.post(
  "/add-quotation",
  authMiddleware,
  authorize("ADMIN, PE"),
  upload.single("file"),
  validate(quotationSchema),
  addQuotation,
);

// inovice
router.post(
  "/add-invoice",
  authMiddleware,
  authorize("ADMIN, PE"),
  upload.single("file"),
  validate(invoiceSchema),
  addInvoice,
);

// HR
// tag
router.post(
  "/tag",
  authMiddleware,
  authorize("ADMIN, HR"),
  validate(tagItemSchema),
  TagItem,
);

export default router;
