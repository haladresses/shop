-- CreateTable
CREATE TABLE "wasellee_settings" (
    "id" TEXT NOT NULL,
    "isNotifyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "companyNameEn" TEXT NOT NULL DEFAULT 'Wasellee',
    "companyNameAr" TEXT NOT NULL DEFAULT 'وصلي',
    "brandNameEn" TEXT NOT NULL DEFAULT 'LO Express',
    "website" TEXT,
    "instagram" TEXT,
    "bousherOfficePhone" TEXT NOT NULL DEFAULT '74186126',
    "bousherContactPhone" TEXT,
    "bousherDriverPhone" TEXT,
    "notifyChatId" TEXT,
    "wahaBaseUrl" TEXT,
    "wahaApiKey" TEXT,
    "wahaSession" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wasellee_settings_pkey" PRIMARY KEY ("id")
);
