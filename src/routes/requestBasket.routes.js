import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  changeBasketStatus,
  createRequestBasket,
  splitItemsToNewBasket,
  viewAllRequestBaskets,
  viewAllRequestBasketsByStatus,
  viewAllRequestBasketsByUserId,
  viewRequestBasketById,
} from "../controllers/requestBasket.controller.js";
import {
  changeStatusSchema,
  createBasketSchema,
  splitItemsSchema,
} from "../validators/requestBasket.schema.js";
import { validate } from "../middleware/validate.js";
import { authorize } from "../middleware/RBACMiddleware.js";

const router = express.Router();

// create basket
router.post(
  "/",
  authMiddleware,
  authorize("ADMIN, DH"),
  validate(createBasketSchema),
  createRequestBasket,
);

// show all baskets
router.get(
  "/view-all",
  authMiddleware,
  authorize("ADMIN, CEO, PE, FM, OM, HR"),
  viewAllRequestBaskets,
);

// show baskets by status
router.get(
  "/view-all/:status",
  authMiddleware,
  authorize("ADMIN, CEO, PE, FM, OM, HR"),
  viewAllRequestBasketsByStatus,
);

// show basket by basket id
router.get(
  "/view-all-by-basektId/:basketId",
  authMiddleware,
  authorize("DH, ADMIN, CEO, PE, FM, OM, HR"),
  viewRequestBasketById,
);

// show baskets by user id
router.get(
  "/view-all-userId/:status",
  authMiddleware,
  authorize("DH, ADMIN, CEO, PE, FM, OM, HR"),
  viewAllRequestBasketsByUserId,
);

// change status
router.post(
  "/change-status",
  authMiddleware,
  authorize("DH, ADMIN, CEO, PE, FM, OM, HR"),
  validate(changeStatusSchema),
  changeBasketStatus,
);

// split items in basket to new basket
router.post(
  "/split",
  authMiddleware,
    authorize("ADMIN, PE, "),
  validate(splitItemsSchema),
  splitItemsToNewBasket,
);

export default router;
