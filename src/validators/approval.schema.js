import { z } from "zod";

export const approvalDecisionSchema = z.object({
  body: z
    .object({
      basketId: z
        .number({
          required_error: "Basket ID is required",
          invalid_type_error: "Basket ID must be a number",
        })
        .int()
        .positive(),

      status: z.enum(["PENDING", "APPROVED", "REJECTED"], {
        errorMap: () => ({
          message: "Status must be either APPROVED or REJECTED",
        }),
      }),

      comment: z
        .string()
        .max(500, "Comment cannot exceed 500 characters")
        .optional()
        .or(z.literal("")), // Allows empty strings
    })
    .refine(
      (data) => {
        if (
          data.status === "REJECTED" &&
          (!data.comment || data.comment.trim().length === 0)
        ) {
          return false;
        }
        return true;
      },
      {
        message: "A comment is required when rejecting a request",
        path: ["comment"],
      },
    ),
});
