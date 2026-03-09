import { z } from "zod";

// --- ADD ITEM ---
export const addItemSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: "Item title is required" })
      .min(3, "Title must be at least 3 characters")
      .max(100, "Title is too long")
      .trim(),

    description: z
      .string({ required_error: "Description is required" })
      .min(10, "Description should be at least 10 characters for clarity")
      .max(500)
      .trim(),

    quantity: z.coerce
      .number({
        required_error: "Quantity is required",
        invalid_type_error: "Quantity must be a number",
      })
      .int()
      .positive("Quantity must be greater than 0"),

    targetDate: z
      .string({ required_error: "Target date is required" })
      .datetime({ message: "Invalid date format. Use ISO 8601" })
      .refine((dateStr) => new Date(dateStr) > new Date(), {
        message: "Target date must be in the future",
      }),

    isHighPriority: z
      .boolean({
        invalid_type_error: "High priority flag must be true or false",
      })
      .default(false),
  }),
});

// --- PATCH ITEM ---
export const patchItemSchema = z.object({
  body: z
    .object({
      title: z.string().min(3).max(100).trim().optional(),
      description: z.string().min(10).max(500).trim().optional(),
      quantity: z.coerce.number().int().positive().optional(),
      targetDate: z.string().datetime().optional(),
      isHighPriority: z.boolean().optional(),
    })
    .partial(),
});

// --- MARK DAMAGED ---
export const markDamagedSchema = z.object({
  body: z.object({
    itemId: z.coerce.number().int().positive(),
    damagedQuantity: z.coerce.number().int().min(1),
  }),
});

// --- WAREHOUSE ---
export const warehouseSchema = z.object({
  body: z.object({
    itemId: z.coerce.number().int().positive(),
    inWarehouse: z.boolean(),
  }),
});

// --- QUOTATION ---
export const quotationSchema = z.object({
  body: z.object({
    itemId: z.coerce.number().int().positive("Item ID must be a valid integer"),
    price: z.coerce.number().positive("Price must be greater than zero").finite(),
  }),
});

// --- INVOICE ---
export const invoiceSchema = z.object({
  body: z.object({
    itemId: z.coerce.number().int().positive(),
    invoiceNumber: z.string().min(2).max(50).trim(),
  }),
});

// --- TAG ITEM ---
export const tagItemSchema = z.object({
  body: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
});
