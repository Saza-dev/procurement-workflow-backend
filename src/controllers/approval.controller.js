import { prisma } from "../config/db.js";

export const makeApprovalDecision = async (req, res) => {
  try {
    const { basketId, status, comment } = req.body;
    const { id: approverId, role: currentApproverRole } = req.user;

    const basket = await prisma.requestBasket.findUnique({
      where: { id: parseInt(basketId) },
    });

    if (!basket) return res.status(404).json({ error: "Basket not found" });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Approval record
      const approvalRecord = await tx.approval.create({
        data: {
          requestId: basket.id,
          approverId: approverId,
          role: currentApproverRole,
          status: status,
          comment: comment || null,
          version: basket.version,
        },
      });

      // 2. Determine new status
      let newBasketStatus = basket.status;
      if (status === "REJECTED") {
        newBasketStatus = "REJECTED_REVISION_REQUIRED";
      } else if (status === "APPROVED") {
        const allApprovalsForVersion = await tx.approval.findMany({
          where: {
            requestId: basket.id,
            version: basket.version,
            status: "APPROVED",
          },
        });

        const approvingRoles = allApprovalsForVersion.map((a) => a.role);
        const requiredRoles = ["CEO", "FM", "OM"];
        const isFullyApproved = requiredRoles.every((role) =>
          approvingRoles.includes(role),
        );

        newBasketStatus = isFullyApproved ? "APPROVED" : "PENDING_APPROVALS";
      }

      // 3. Update the basket
      const updatedBasket = await tx.requestBasket.update({
        where: { id: basket.id },
        data: { status: newBasketStatus },
      });

      // 4. LOG: Audit the Approval Decision
      // This tracks the "Human" action
      await tx.auditLog.create({
        data: {
          entityName: "Approval",
          entityId: approvalRecord.id,
          action: "DECISION_SUBMITTED",
          userId: approverId,
          newValue: {
            status: status,
            role: currentApproverRole,
            comment: comment,
            basketVersion: basket.version,
          },
        },
      });

      // 5. LOG: Audit the Basket Status Change
      // Only log if the status actually changed
      if (basket.status !== newBasketStatus) {
        await tx.auditLog.create({
          data: {
            entityName: "RequestBasket",
            entityId: basket.id,
            action: "STATUS_TRANSITION",
            userId: approverId,
            oldValue: { status: basket.status },
            newValue: {
              status: newBasketStatus,
              reason: `Triggered by ${currentApproverRole} ${status}`,
            },
          },
        });
      }

      return updatedBasket;
    });

    return res.status(200).json({
      message: `Decision recorded. Basket is now ${result.status}`,
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to process approval" });
  }
};

export const viewBasketApprovals = async (req, res) => {
  try {
    const { bucketId } = req.params;

    const approvals = await prisma.approval.findMany({
      where: { requestId: parseInt(bucketId) },
      include: {
        approver: {
          select: { email: true, role: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (approvals.length === 0) {
      return res
        .status(200)
        .json({ message: "No approval history found", data: [] });
    }

    return res.status(200).json({ data: approvals });
  } catch (error) {
    console.error("View Approval Error:", error);
    return res.status(500).json({ error: "Failed to fetch approval history" });
  }
};

export const viewBaskets = async (req, res) => {
  try {
    const approvals = await prisma.requestBasket.findMany({
      where: { status: "PENDING_APPROVALS" },
      include: { items: true },
      orderBy: { updatedAt: "desc" },
    });

    if (approvals.length === 0) {
      return res
        .status(200)
        .json({ message: "No approval history found", data: [] });
    }

    return res.status(200).json({ data: approvals });
  } catch (error) {
    console.error("View Approval Error:", error);
    return res.status(500).json({ error: "Failed to fetch approval history" });
  }
};
