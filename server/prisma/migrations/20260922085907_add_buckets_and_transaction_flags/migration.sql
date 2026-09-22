-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "bucketId" TEXT,
ADD COLUMN     "isNonBudget" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Bucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bucket_name_key" ON "Bucket"("name");

-- CreateIndex
CREATE INDEX "Transaction_bucketId_idx" ON "Transaction"("bucketId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "Bucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
