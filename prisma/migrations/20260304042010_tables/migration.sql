-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVALS', 'REJECTED_REVISION_REQUIRED', 'APPROVED', 'PURCHASED', 'FINANCE_RECHECK_REQUIRED', 'HANDED_OVER', 'DONE');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'DAMAGED', 'RE_PURCHASED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RequestBasket" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "justification" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalValue" DECIMAL(65,30),
    "requesterId" INTEGER NOT NULL,
    "parentRequestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestBasket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestItem" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(65,30),
    "quoteUrl" TEXT,
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
    "inWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "tag" TEXT,
    "condition" "ItemCondition",
    "requestBasketId" INTEGER NOT NULL,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "approverId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RequestBasket" ADD CONSTRAINT "RequestBasket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestBasket" ADD CONSTRAINT "RequestBasket_parentRequestId_fkey" FOREIGN KEY ("parentRequestId") REFERENCES "RequestBasket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestBasketId_fkey" FOREIGN KEY ("requestBasketId") REFERENCES "RequestBasket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RequestBasket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
