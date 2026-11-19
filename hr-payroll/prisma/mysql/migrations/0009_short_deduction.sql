-- AlterTable
ALTER TABLE `DeductionEntry` ADD COLUMN `timeEntryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `graceMinutes` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `shortDeduction` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX `DeductionEntry_timeEntryId_key` ON `DeductionEntry`(`timeEntryId`);

