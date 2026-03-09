import { z } from "zod";

// --- CREATE BASKET ---
export const createBasketSchema = z.object({
  body: z.object({
    title: z
      .string({
        required_error: "Title is required",
        invalid_type_error: "Title must be a string",
      })
      .min(5, "Title is too short (min 5 characters)")
      .max(100, "Title is too long (max 100 characters)")
      .trim(),

    justification: z
      .string({
        invalid_type_error: "Justification must be a string",
      })
      .min(
        10,
        "Please provide a more detailed justification (min 10 characters)",
      )
      .max(500, "Justification is too long (max 500 characters)")
      .optional()
      .or(z.literal("")),
  }),
});

// --- CHANGE STATUS ---
export const changeStatusSchema = z.object({
  body: z.object({
    basketId: z
      .number({
        required_error: "Basket ID is required",
        invalid_type_error: "Basket ID must be a number",
      })
      .int()
      .positive(),

    status: z.enum(
      [
        "DRAFT",
        "SUBMITTED",
        "PENDING_APPROVALS",
        "REJECTED_REVISION_REQUIRED",
        "APPROVED",
        "PURCHASED",
        "HANDED_OVER",
        "MOVE_HR",
        "DONE",
      ],
      {
        errorMap: () => ({
          message:
            "Invalid basket status. Must be a valid RequestStatus value.",
        }),
      },
    ),
  }),
});

// --- SPLIT ITEMS ---
export const splitItemsSchema = z.object({
  body: z.object({
    originalBasketId: z
      .number({
        required_error: "Original Basket ID is required",
        invalid_type_error: "Basket ID must be a number",
      })
      .int()
      .positive(),

    itemsToMove: z
      .array(
        z.object({
          itemId: z
            .number({ required_error: "Item ID is required" })
            .int()
            .positive(),
          quantity: z
            .number({ required_error: "Quantity is required" })
            .int()
            .min(1, "Quantity must be at least 1"),
        }),
      )
      .min(1, "You must select at least one item to move"),
  }),
});
