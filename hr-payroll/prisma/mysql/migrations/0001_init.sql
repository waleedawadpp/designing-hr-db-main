-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `disabledAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `monthlySalary` DOUBLE NULL,
    `dailyWage` DOUBLE NULL,
    `dailyHours` DOUBLE NOT NULL DEFAULT 9,
    `hireDate` VARCHAR(191) NULL,
    `endDate` VARCHAR(191) NULL,
    `leavesBeforeSystem` DOUBLE NULL,
    `notes` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_code_key`(`code`),
    UNIQUE INDEX `Employee_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceMonth` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `dupSeq` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `AttendanceMonth_employeeId_month_idx`(`employeeId`, `month`),
    INDEX `AttendanceMonth_month_idx`(`month`),
    UNIQUE INDEX `AttendanceMonth_employeeId_month_dupSeq_key`(`employeeId`, `month`, `dupSeq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceDay` (
    `id` VARCHAR(191) NOT NULL,
    `monthId` VARCHAR(191) NOT NULL,
    `day` INTEGER NOT NULL,
    `code` VARCHAR(191) NULL,

    UNIQUE INDEX `AttendanceDay_monthId_day_key`(`monthId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExtraEntry` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `rawName` VARCHAR(191) NULL,
    `item` VARCHAR(191) NULL,
    `actualTime` DOUBLE NULL,
    `bonusAmount` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ExtraEntry_employeeId_date_idx`(`employeeId`, `date`),
    INDEX `ExtraEntry_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeductionEntry` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `rawName` VARCHAR(191) NULL,
    `item` VARCHAR(191) NULL,
    `lateMinutes` DOUBLE NULL,
    `amount` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `DeductionEntry_employeeId_date_idx`(`employeeId`, `date`),
    INDEX `DeductionEntry_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `systemStartYear` INTEGER NOT NULL DEFAULT 2026,
    `weeklyOffDay` INTEGER NOT NULL DEFAULT 5,
    `annualLeaveEntitlement` INTEGER NOT NULL DEFAULT 30,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userEmail` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `before` TEXT NULL,
    `after` TEXT NULL,

    INDEX `AuditLog_at_idx`(`at`),
    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AttendanceMonth` ADD CONSTRAINT `AttendanceMonth_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceDay` ADD CONSTRAINT `AttendanceDay_monthId_fkey` FOREIGN KEY (`monthId`) REFERENCES `AttendanceMonth`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExtraEntry` ADD CONSTRAINT `ExtraEntry_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeductionEntry` ADD CONSTRAINT `DeductionEntry_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

