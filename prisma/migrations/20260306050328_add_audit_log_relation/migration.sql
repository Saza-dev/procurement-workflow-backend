-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_basket_fkey" FOREIGN KEY ("entityId") REFERENCES "RequestBasket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
