import { prisma } from "../config/db.js";

// add items to basket
export const addItem = async (req, res) => {
  try {
    const { basketId } = req.params;
    const { title, description, quantity, targetDate, isHighPriority } =
      req.body;
    const { id: userId } = req.user;

    const bId = parseInt(basketId);

    const basket = await prisma.requestBasket.findUnique({
      where: { id: bId },
    });

    if (!basket) return res.status(404).json({ error: "Basket not found" });

    if (basket.status !== "DRAFT") {
      return res
        .status(403)
        .json({ error: "Cannot add items to a non-draft basket" });
    }

    const daysUntil =
      (new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24);
    const isUrgent = isHighPriority && daysUntil < 3;

    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.requestItem.create({
        data: {
          title,
          description,
          quantity: parseInt(quantity),
          targetDate: new Date(targetDate),
          isUrgent,
          requestBasketId: bId,
        },
      });

      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: item.id,
          action: "ITEM_ADDED",
          userId: userId,
          newValue: {
            basketId: bId,
            title: item.title,
            quantity: item.quantity,
            isUrgent: item.isUrgent,
          },
        },
      });

      return item;
    });

    return res.status(201).json(newItem);
  } catch (error) {
    console.error("Add Item Error:", error);
    return res.status(500).json({ error: "Failed to create item" });
  }
};

// view items by basket Id
export const viewItemsByBasketId = async (req, res) => {
  try {
    const basketId = parseInt(req.params.basketId);

    const items = await prisma.requestItem.findMany({
      where: { requestBasketId: basketId },
    });

    return res.status(200).json({ data: items });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch items" });
  }
};

// update basket item
export const updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { title, description, quantity, targetDate, isHighPriority } =
      req.body;
    const { id: userId } = req.user;
    const id = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      const currentItem = await tx.requestItem.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new Error("NOT_FOUND");
      }

      let finalUrgentStatus = currentItem.isUrgent;
      if (targetDate !== undefined || isHighPriority !== undefined) {
        const dateToUse = targetDate
          ? new Date(targetDate)
          : currentItem.targetDate;

        const priorityToUse =
          isHighPriority !== undefined ? isHighPriority : false;

        const daysUntil =
          (new Date(dateToUse) - new Date()) / (1000 * 60 * 60 * 24);
        finalUrgentStatus = priorityToUse && daysUntil < 3;
      }

      const updatedItem = await tx.requestItem.update({
        where: { id },
        data: {
          title: title ?? undefined,
          description: description ?? undefined,
          quantity: quantity !== undefined ? parseInt(quantity) : undefined,
          targetDate: targetDate ? new Date(targetDate) : undefined,
          isUrgent: finalUrgentStatus,
        },
      });

      const changes = {};
      const oldState = {};

      const fieldsToTrack = [
        "title",
        "description",
        "quantity",
        "targetDate",
        "isUrgent",
      ];

      fieldsToTrack.forEach((field) => {
        const isDate = currentItem[field] instanceof Date;
        const hasChanged = isDate
          ? currentItem[field].getTime() !== updatedItem[field].getTime()
          : currentItem[field] !== updatedItem[field];

        if (hasChanged) {
          oldState[field] = currentItem[field];
          changes[field] = updatedItem[field];
        }
      });

      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            entityName: "RequestItem",
            entityId: id,
            action: "UPDATE",
            userId: userId,
            oldValue: oldState,
            newValue: changes,
          },
        });
      }

      return updatedItem;
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ error: "Item not found" });
    console.error(error);
    return res.status(500).json({ error: "Update failed" });
  }
};

// Remove Item
export const removeItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { id: userId } = req.user;
    const id = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      const itemToDelete = await tx.requestItem.findUnique({
        where: { id },
      });

      if (!itemToDelete) {
        throw new Error("NOT_FOUND");
      }

      const basket = await tx.requestBasket.findUnique({
        where: { id: itemToDelete.requestBasketId },
      });

      if (basket.status !== "DRAFT") {
        throw new Error("FORBIDDEN");
      }

      await tx.requestItem.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: id,
          action: "DELETE",
          userId: userId,
          oldValue: itemToDelete,
          newValue: null,
        },
      });

      return itemToDelete;
    });

    return res.status(200).json({
      message: `Item '${result.title}' deleted successfully.`,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Item not found" });
    }
    if (error.message === "FORBIDDEN") {
      return res
        .status(403)
        .json({ error: "Cannot delete items from a non-draft basket" });
    }
    console.error(error);
    return res.status(500).json({ error: "Delete failed" });
  }
};

// mark item good
export const updateItemCondition = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { condition, note } = req.body;
    const { id: userId, role: userRole } = req.user;

    const id = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.requestItem.findUnique({
        where: { id },
      });

      if (!item) throw new Error("ITEM_NOT_FOUND");

      const updatedItem = await tx.requestItem.update({
        where: { id },
        data: {
          condition: "GOOD",
        },
      });

      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: id,
          action: "CONDITION_CHANGE",
          userId: userId,
          oldValue: { condition: item.condition },
          newValue: {
            condition: "GOOD",
            note: note || `Condition updated by ${userRole}`,
            resolvedAt: new Date(),
          },
        },
      });

      return updatedItem;
    });

    return res.status(200).json({
      message: `Item condition updated to ${condition}`,
      data: result,
    });
  } catch (error) {
    if (error.message === "ITEM_NOT_FOUND") {
      return res.status(404).json({ error: "Item not found" });
    }
    console.error("Condition Update Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Mark item damaged
export const splitAndMarkDamaged = async (req, res) => {
  try {
    const { itemId, damagedQuantity } = req.body;
    const { id: userId } = req.user;
    const id = parseInt(itemId);

    const originalItem = await prisma.requestItem.findUnique({
      where: { id },
    });

    if (!originalItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    // --- CASE 1: Marking the ENTIRE item as damaged ---
    if (damagedQuantity >= originalItem.quantity) {
      const result = await prisma.$transaction(async (tx) => {
        const updatedItem = await tx.requestItem.update({
          where: { id: originalItem.id },
          data: { condition: "DAMAGED" }, // ItemCondition.DAMAGED
        });

        await tx.auditLog.create({
          data: {
            entityName: "RequestItem",
            entityId: originalItem.id,
            action: "MARK_DAMAGED",
            userId: userId,
            oldValue: { condition: originalItem.condition },
            newValue: {
              condition: "DAMAGED",
              note: "Entire quantity marked damaged",
            },
          },
        });

        return updatedItem;
      });

      return res
        .status(200)
        .json({ message: "Entire item marked as damaged", data: result });
    }

    // --- CASE 2: Splitting the item into Good/Damaged ---
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrease quantity of original (The "Good" part)
      const decreasedItem = await tx.requestItem.update({
        where: { id: originalItem.id },
        data: {
          quantity: originalItem.quantity - damagedQuantity,
          condition: "GOOD",
        },
      });

      // 2. Create the new damaged item entry
      const damagedItem = await tx.requestItem.create({
        data: {
          title: `${originalItem.title} (Damaged Portion)`,
          description: originalItem.description,
          quantity: damagedQuantity,
          targetDate: originalItem.targetDate,
          isUrgent: originalItem.isUrgent,
          requestBasketId: originalItem.requestBasketId,
          condition: "DAMAGED",
          tag: originalItem.tag,
        },
      });

      // 3. LOG: Audit for the Original Item (The Reduction)
      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: originalItem.id,
          action: "QUANTITY_REDUCED_BY_DAMAGE",
          userId: userId,
          oldValue: { quantity: originalItem.quantity },
          newValue: {
            quantity: decreasedItem.quantity,
            splitToId: damagedItem.id,
            reason: "Damage split",
          },
        },
      });

      // 4. LOG: Audit for the New Damaged Item (The Origin)
      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: damagedItem.id,
          action: "CREATE_FROM_DAMAGE_SPLIT",
          userId: userId,
          newValue: {
            originalItemId: originalItem.id,
            quantity: damagedQuantity,
          },
        },
      });

      return { decreasedItem, damagedItem };
    });

    return res.status(200).json({
      message: "Item split successfully",
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to split item" });
  }
};

// view items by condition
export const viewItemsByCondition = async (req, res) => {
  try {
    const { condition } = req.params;

    const items = await prisma.requestItem.findMany({
      where: {
        condition: condition.toUpperCase(),
      },
      include: {
        requestBasket: {
          select: { title: true, requesterId: true },
        },
      },
    });

    if (items.length === 0) {
      return res
        .status(200)
        .json({ message: "No items found with this condition", data: [] });
    }

    return res.status(200).json({ data: items });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Failed to fetch items by condition" });
  }
};

// view users items by condition
export const viewUserItemsByCondition = async (req, res) => {
  try {
    const { condition } = req.params;
    const userId = req.user.id;
    const parsedUserId = parseInt(userId);

    if (!Object.values(ItemCondition).includes(condition.toUpperCase())) {
      return res.status(400).json({
        error: `Invalid condition. Valid options: ${Object.values(ItemCondition).join(", ")}`,
      });
    }

    const items = await prisma.requestItem.findMany({
      where: {
        condition: condition.toUpperCase(),
        requestBasket: {
          requesterId: parsedUserId,
        },
      },
      include: {
        requestBasket: {
          select: {
            title: true,
            status: true,
          },
        },
      },
    });

    if (items.length === 0) {
      return res.status(200).json({
        message: "No items found for this user with that condition",
        data: [],
      });
    }

    return res.status(200).json({ data: items });
  } catch (error) {
    console.error("Filter Error:", error);
    return res.status(500).json({ error: "Failed to fetch filtered items" });
  }
};

// warehouse check
export const warehouseCheck = async (req, res) => {
  try {
    const { itemId, inWarehouse } = req.body;
    const { id: userId } = req.user;
    const id = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current state to see if status actually changed
      const currentItem = await tx.requestItem.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new Error("NOT_FOUND");
      }

      // 2. Perform the update
      const updatedItem = await tx.requestItem.update({
        where: { id },
        data: {
          inWarehouse: inWarehouse,
          condition: "GOOD", // Assuming checking into warehouse resets/confirms GOOD condition
        },
      });

      // 3. LOG: Audit the Warehouse Receipt
      // We only log if there's a change to avoid "spamming" the log with identical updates
      if (
        currentItem.inWarehouse !== inWarehouse ||
        currentItem.condition !== "GOOD"
      ) {
        await tx.auditLog.create({
          data: {
            entityName: "RequestItem",
            entityId: id,
            action: inWarehouse ? "WAREHOUSE_RECEIVE" : "WAREHOUSE_REMOVE",
            userId: userId,
            oldValue: {
              inWarehouse: currentItem.inWarehouse,
              condition: currentItem.condition,
            },
            newValue: {
              inWarehouse: updatedItem.inWarehouse,
              condition: updatedItem.condition,
            },
          },
        });
      }

      return updatedItem;
    });

    return res.status(200).json({
      message: "Warehouse status updated",
      data: result,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Item not found" });
    }
    console.error("Warehouse Check Error:", error);
    return res.status(500).json({ error: "Warehouse check failed" });
  }
};

// add quotation per item
export const addQuotation = async (req, res) => {
  try {
    const { itemId, price, quoteUrl } = req.body;
    const { id: userId } = req.user;
    const iId = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current item and basket for "oldValue" comparison
      const currentItem = await tx.requestItem.findUnique({
        where: { id: iId },
        include: { requestBasket: true },
      });

      if (!currentItem) throw new Error("NOT_FOUND");

      // 2. Update the Item with Quote details
      const updatedItem = await tx.requestItem.update({
        where: { id: iId },
        data: {
          price: parseFloat(price),
          quoteUrl: quoteUrl,
        },
      });

      // 3. LOG: Audit the Item Quotation
      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: iId,
          action: "ADD_QUOTATION",
          userId: userId,
          oldValue: {
            price: currentItem.price,
            quoteUrl: currentItem.quoteUrl,
          },
          newValue: {
            price: updatedItem.price,
            quoteUrl: updatedItem.quoteUrl,
          },
        },
      });

      // 4. Calculate Total Basket Value
      const allItems = await tx.requestItem.findMany({
        where: { requestBasketId: updatedItem.requestBasketId },
      });

      const allHavePrices = allItems.every((item) => item.price !== null);
      let totalValue = 0;

      if (allHavePrices) {
        totalValue = allItems.reduce((sum, item) => {
          const itemTotal = Number(item.price || 0) * item.quantity;
          return sum + itemTotal;
        }, 0);

        // 5. Update the Basket
        await tx.requestBasket.update({
          where: { id: updatedItem.requestBasketId },
          data: { totalValue: totalValue },
        });

        // 6. LOG: Audit the Basket Total Update
        // Only log if the total value actually changed from before
        if (Number(currentItem.requestBasket.totalValue) !== totalValue) {
          await tx.auditLog.create({
            data: {
              entityName: "RequestBasket",
              entityId: updatedItem.requestBasketId,
              action: "TOTAL_VALUE_UPDATED",
              userId: userId,
              oldValue: { totalValue: currentItem.requestBasket.totalValue },
              newValue: {
                totalValue: totalValue,
                triggeredByItemId: iId,
                note: "All items now have quotes",
              },
            },
          });
        }
      }

      return { updatedItem, totalValue, allHavePrices };
    });

    return res.status(200).json({
      message: result.allHavePrices
        ? `Quotation added. Basket Total updated to: ${result.totalValue}`
        : "Quotation added to item",
      data: result.updatedItem,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND" || error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    console.error("Quotation Update Error:", error);
    return res
      .status(500)
      .json({ error: "Failed to add quotation and update total" });
  }
};

// add invoice
export const addInvoice = async (req, res) => {
  try {
    const { itemId, invoiceNumber, invoiceUrl } = req.body;
    const { id: userId } = req.user;
    const iId = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current state for comparison
      const currentItem = await tx.requestItem.findUnique({
        where: { id: iId },
        include: { requestBasket: true },
      });

      if (!currentItem) throw new Error("NOT_FOUND");

      // 2. Update the Item with Invoice details
      const updatedItem = await tx.requestItem.update({
        where: { id: iId },
        data: {
          invoiceNumber,
          invoiceUrl,
        },
      });

      // 3. LOG: Audit the Item Invoice Attachment
      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: iId,
          action: "ADD_INVOICE",
          userId: userId,
          oldValue: { invoiceNumber: currentItem.invoiceNumber },
          newValue: {
            invoiceNumber: updatedItem.invoiceNumber,
            invoiceUrl: updatedItem.invoiceUrl,
          },
        },
      });

      // 4. Check if all items in the basket are now invoiced
      const allItems = await tx.requestItem.findMany({
        where: { requestBasketId: updatedItem.requestBasketId },
      });

      const allInvoiced = allItems.every((item) => item.invoiceNumber !== null);
      let basketUpdated = false;

      if (allInvoiced && currentItem.requestBasket.status !== "MOVE_HR") {


        // 6. LOG: Audit the Basket Status Change
        await tx.auditLog.create({
          data: {
            entityName: "RequestBasket",
            entityId: updatedItem.requestBasketId,
            action: "STATUS_CHANGE_TO_MOVE_HR",
            userId: userId,
            oldValue: { status: currentItem.requestBasket.status },
            newValue: {
              status: "MOVE_HR",
              reason: "All items successfully invoiced",
              finalTriggerItem: iId,
            },
          },
        });

        basketUpdated = true;
      }

      return { updatedItem, basketUpdated };
    });

    return res.status(200).json({
      message: result.basketUpdated
        ? "Invoice linked and Basket marked as MOVE_HR"
        : "Invoice linked successfully",
      data: result.updatedItem,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND" || error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    console.error("Invoice Error:", error);
    return res.status(500).json({ error: "Failed to add invoice" });
  }
};

// add tag
export const TagItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const { id: userId } = req.user;
    const currentYear = new Date().getFullYear();
    const id = parseInt(itemId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current item state
      const item = await tx.requestItem.findUnique({
        where: { id },
      });

      if (!item) throw new Error("NOT_FOUND");

      // 2. Generate the Tag
      const paddedId = String(item.id).padStart(4, "0");
      const generatedTag = `$${currentYear}-${paddedId}-${item.title}`;

      // 3. Update the Item
      const updatedItem = await tx.requestItem.update({
        where: { id: item.id },
        data: {
          tag: generatedTag,
          condition: "GOOD",
        },
      });

      // 4. LOG: Audit the Tagging Event
      await tx.auditLog.create({
        data: {
          entityName: "RequestItem",
          entityId: item.id,
          action: "ASSET_TAGGED",
          userId: userId,
          oldValue: { tag: item.tag, condition: item.condition },
          newValue: {
            tag: generatedTag,
            condition: "GOOD",
            note: "Official asset tag generated and assigned",
          },
        },
      });

      return { updatedItem, generatedTag };
    });

    return res.status(200).json({
      message: "Asset tag added",
      tag: result.generatedTag,
      data: result.updatedItem,
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Item not found" });
    }
    console.error("Tagging Error:", error);
    return res.status(500).json({ error: "Failed to add tag" });
  }
};
