-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `weeklyOff` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `payByAttendanceFrom` VARCHAR(191) NULL DEFAULT '2026-11';

