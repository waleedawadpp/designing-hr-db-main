-- AlterTable
ALTER TABLE `ExtraEntry` ADD COLUMN `rateKind` VARCHAR(191) NULL,
    ADD COLUMN `timeEntryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `holidayRate` DOUBLE NOT NULL DEFAULT 1.5,
    ADD COLUMN `overtimeRate` DOUBLE NOT NULL DEFAULT 1.5,
    ADD COLUMN `standardHours` DOUBLE NOT NULL DEFAULT 9;

-- CreateTable
CREATE TABLE `TimeEntry` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `checkIn` VARCHAR(191) NULL,
    `checkOut` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TimeEntry_date_idx`(`date`),
    UNIQUE INDEX `TimeEntry_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `date` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ExtraEntry_timeEntryId_key` ON `ExtraEntry`(`timeEntryId`);

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

