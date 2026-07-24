-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "purchaseValue" DOUBLE PRECISION,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outstandingBalance" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION,
    "emiAmount" DOUBLE PRECISION,
    "nextDueDate" TIMESTAMP(3),
    "lender" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "cashAndBank" DOUBLE PRECISION NOT NULL,
    "investments" DOUBLE PRECISION NOT NULL,
    "retirement" DOUBLE PRECISION NOT NULL,
    "otherAssets" DOUBLE PRECISION NOT NULL,
    "liabilities" DOUBLE PRECISION NOT NULL,
    "netWorth" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_date_key" ON "NetWorthSnapshot"("date");
