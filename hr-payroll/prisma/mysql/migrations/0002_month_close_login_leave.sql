-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `annualLeave` INTEGER NULL;

-- CreateTable
CREATE TABLE `MonthClose` (
    `month` VARCHAR(191) NOT NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedBy` VARCHAR(191) NOT NULL,
    `snapshot` LONGTEXT NOT NULL,

    PRIMARY KEY (`month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `ok` BOOLEAN NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginAttempt_email_at_idx`(`email`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

