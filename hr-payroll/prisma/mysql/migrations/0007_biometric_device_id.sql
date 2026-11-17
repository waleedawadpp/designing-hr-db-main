-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `deviceId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Employee_deviceId_key` ON `Employee`(`deviceId`);

