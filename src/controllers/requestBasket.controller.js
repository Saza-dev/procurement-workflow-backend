import { prisma } from "../config/db.js";

// create basket
export const createRequestBasket = async (req, res) => {
  try {
    const { title, justification } = req.body;
    const { id: userId } = req.user;
    const result = await prisma.$transaction(async (tx) => {
      const basket = await tx.requestBasket.create({
        data: {
          title,
          justification,
          requesterId: userId,
          status: "DRAFT",
          version: 1,
        },
      });

      // Log the creation
      await tx.auditLog.create({
        data: {
          entityName: "RequestBasket",
          entityId: basket.id,
          action: "CREATE",
          newValue: basket,
          userId: userId,
        },
      });

      return basket;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Create Request Error:", error);
    return res.status(500).json({ error: "Failed to create request" });
  }
};

// view all request baskets
export const viewAllRequestBaskets = async (req, res) => {
  try {
    const baskets = await prisma.requestBasket.findMany({
      include: { items: true },
    });

    if (baskets.length === 0) {
      return res
        .status(200)
        .json({ message: "No baskets available", data: [] });
    }

    return res.status(200).json({ data: { baskets } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch baskets" });
  }
};

// view baskets by status
export const viewAllRequestBasketsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const baskets = await prisma.requestBasket.findMany({
      where: { status: status.toUpperCase() },
      include: { items: true, requester: true, approvals: true },
    });

    if (baskets.length === 0) {
      return res
        .status(200)
        .json({ message: "No baskets available for this status", data: [] });
    }

    return res.status(200).json({ data: { baskets } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch baskets by status" });
  }
};

// view basket request by Id
export const viewRequestBasketById = async (req, res) => {
  try {
    const { basketId } = req.params;

    const basket = await prisma.requestBasket.findUnique({
      where: { id: parseInt(basketId) },
      include: {
        items: true,
        requester: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    if (!basket) return res.status(404).json({ error: "Basket not found" });
    return res.status(200).json(basket);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// view basekt by user ID
export const viewAllRequestBasketsByUserId = async (req, res) => {
  const { id: userId } = req.user;
  const { status } = req.params;

  // 1. Fetch Baskets
  const baskets = await prisma.requestBasket.findMany({
    where: {
      requesterId: userId,
      ...(status !== "ALL" && { status: status.toUpperCase() }),
    },
    include: {
      items: true,
      approvals: { include: { approver: true } },
    },
  });

  const basketsWithLogs = await Promise.all(
    baskets.map(async (basket) => {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityName: "RequestBasket",
          entityId: basket.id,
        },
        include: { user: { select: { email: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });
      return { ...basket, auditLogs: logs };
    }),
  );

  return res.status(200).json({ data: basketsWithLogs });
};

// change basket status
export const changeBasketStatus = async (req, res) => {
  try {
    const { status, basketId } = req.body;
    const { id: userId } = req.user;

    const id = parseInt(basketId);

    const result = await prisma.$transaction(async (tx) => {
      const currentBasket = await tx.requestBasket.findUnique({
        where: { id },
      });

      if (!currentBasket) {
        throw new Error("NOT_FOUND");
      }
      const updatedBasket = await tx.requestBasket.update({
        where: { id },
        data: { status: status },
      });

      await tx.auditLog.create({
        data: {
          entityName: "RequestBasket",
          entityId: id,
          action: "STATUS_CHANGE",
          userId: userId,
          oldValue: { status: currentBasket.status },
          newValue: { status: status },
        },
      });

      return updatedBasket;
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "NOT_FOUND" || error.code === "P2025") {
      return res.status(404).json({ error: "Basket not found" });
    }
    console.error("Audit Log Error:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
};

// split basket
export const splitItemsToNewBasket = async (req, res) => {
  try {
    const { originalBasketId, itemsToMove } = req.body;
    const { id: userId } = req.user;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get Parent Basket state for the log
      const parentBasket = await tx.requestBasket.findUnique({
        where: { id: parseInt(originalBasketId) },
        include: { items: true },
      });

      if (!parentBasket) throw new Error("Original basket not found");

      // 2. Create the Child Basket
      const childBasket = await tx.requestBasket.create({
        data: {
          title: `${parentBasket.title} (Split - Part 2)`,
          justification: parentBasket.justification,
          requesterId: parentBasket.requesterId,
          status: "SUBMITTED",
          parentRequestId: parentBasket.id,
          version: parentBasket.version + 1,
        },
      });

      // 3. Process Items & Track changes for the log
      for (const moveItem of itemsToMove) {
        const originalItem = parentBasket.items.find(
          (i) => i.id === moveItem.itemId,
        );

        if (!originalItem || originalItem.quantity < moveItem.quantity) {
          throw new Error(`Invalid quantity for item ID ${moveItem.itemId}`);
        }

        // Create item in New Basket
        await tx.requestItem.create({
          data: {
            title: originalItem.title,
            description: originalItem.description,
            quantity: moveItem.quantity,
            targetDate: originalItem.targetDate,
            isUrgent: originalItem.isUrgent,
            requestBasketId: childBasket.id,
            price: originalItem.price,
            inWarehouse: originalItem.inWarehouse,
          },
        });

        // Update or Delete original item
        if (originalItem.quantity === moveItem.quantity) {
          await tx.requestItem.delete({ where: { id: originalItem.id } });
        } else {
          await tx.requestItem.update({
            where: { id: originalItem.id },
            data: { quantity: originalItem.quantity - moveItem.quantity },
          });
        }
      }

      // 4. LOG: Audit for the Parent Basket (Record the split event)
      await tx.auditLog.create({
        data: {
          entityName: "RequestBasket",
          entityId: parentBasket.id,
          action: "SPLIT_OUT",
          userId: userId,
          oldValue: {
            items: parentBasket.items.map((i) => ({
              id: i.id,
              qty: i.quantity,
            })),
          },
          newValue: {
            message: "Items split to new basket",
            childBasketId: childBasket.id,
            movedItems: itemsToMove,
          },
        },
      });

      // 5. LOG: Audit for the Child Basket (Record the origin)
      await tx.auditLog.create({
        data: {
          entityName: "RequestBasket",
          entityId: childBasket.id,
          action: "CREATE_VIA_SPLIT",
          userId: userId,
          newValue: {
            parentBasketId: parentBasket.id,
            initialItems: itemsToMove,
          },
        },
      });

      return childBasket;
    });

    return res.status(201).json({
      message: "Items successfully split into a new basket",
      newBasket: result,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to split into new basket" });
  }
};

// delete basket
export const DeleteBasket = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role: userRole } = req.user;

    const basketId = parseInt(id);

    // 1. Find the basket to check status and ownership
    const basket = await prisma.requestBasket.findUnique({
      where: { id: basketId },
      include: { items: true }, // Optional: check if items exist
    });

    if (!basket) {
      return res.status(404).json({ error: "Request basket not found" });
    }

    // 2. VALIDATION: Only allow deletion if status is DRAFT
    if (basket.status !== "DRAFT") {
      return res.status(403).json({
        error: "Forbidden: Only baskets in DRAFT status can be deleted.",
      });
    }

    // 3. SECURITY: Ensure DH can only delete their own drafts (ADMIN can delete any)
    if (userRole !== "ADMIN" && basket.requesterId !== userId) {
      return res.status(403).json({
        error: "Unauthorized: You can only delete your own draft baskets.",
      });
    }

    // 4. TRANSACTION: Delete related data first
    await prisma.$transaction(async (tx) => {
      // A. Delete associated RequestItems
      await tx.requestItem.deleteMany({
        where: { requestBasketId: basketId },
      });

      // B. Delete associated Approvals (though drafts usually don't have them)
      await tx.approval.deleteMany({
        where: { requestId: basketId },
      });

      // C. Delete the Basket itself
      await tx.requestBasket.delete({
        where: { id: basketId },
      });

      // D. LOG: Audit the deletion
      await tx.auditLog.create({
        data: {
          entityName: "RequestBasket",
          entityId: basketId,
          action: "BASKET_DELETED",
          userId: userId,
          oldValue: { title: basket.title, status: basket.status },
          newValue: { message: "Record removed from database" },
        },
      });
    });

    return res.status(200).json({
      message: "Draft basket and all associated items deleted successfully",
    });
  } catch (error) {
    console.error("Delete Basket Error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during deletion" });
  }
};
