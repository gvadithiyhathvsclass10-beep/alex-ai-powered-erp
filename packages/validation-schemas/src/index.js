"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentAttachmentSchema = exports.assignmentSchema = exports.assessmentResultSchema = exports.assessmentSchema = exports.attendanceRecordSchema = exports.attendanceSessionSchema = exports.projectDiscussionSchema = exports.projectMilestoneSchema = exports.projectTaskSchema = exports.projectMentorSchema = exports.projectMemberSchema = exports.projectSchema = exports.researchNoteSchema = exports.researchSourceSchema = exports.researchNotebookSchema = exports.aiModelConfigSchema = exports.aiCredentialSchema = exports.notificationPreferenceSchema = exports.notificationSchema = exports.plannerEventSchema = exports.taskSchema = exports.userMemorySchema = exports.messageSchema = exports.conversationSchema = exports.documentProcessingJobSchema = exports.documentChunkSchema = exports.documentSchema = exports.lecturerAssignmentSchema = exports.subjectEnrollmentSchema = exports.subjectSchema = exports.collegeMembershipSchema = exports.userSchema = exports.semesterSchema = exports.academicYearSchema = exports.courseSchema = exports.departmentSchema = exports.institutionSchema = exports.aiProviderTypeSchema = exports.memoryCategorySchema = exports.projectRoleSchema = exports.projectStatusSchema = exports.notificationCategorySchema = exports.achievementCategorySchema = exports.assignmentStatusSchema = exports.assessmentTypeSchema = exports.attendanceStatusSchema = exports.documentTypeSchema = exports.documentStatusSchema = exports.membershipStatusSchema = exports.userRoleSchema = void 0;
exports.assessmentInputSchema = exports.attendanceRecordInputSchema = exports.attendanceSessionInputSchema = exports.projectDiscussionInputSchema = exports.projectMilestoneInputSchema = exports.projectTaskInputSchema = exports.projectMentorInputSchema = exports.projectMemberInputSchema = exports.projectInputSchema = exports.researchNoteInputSchema = exports.researchSourceInputSchema = exports.researchNotebookInputSchema = exports.aiModelConfigInputSchema = exports.aiCredentialInputSchema = exports.notificationPreferenceInputSchema = exports.notificationInputSchema = exports.plannerEventInputSchema = exports.taskInputSchema = exports.userMemoryInputSchema = exports.messageInputSchema = exports.conversationInputSchema = exports.documentProcessingJobInputSchema = exports.documentChunkInputSchema = exports.documentInputSchema = exports.lecturerAssignmentInputSchema = exports.subjectEnrollmentInputSchema = exports.subjectInputSchema = exports.collegeMembershipInputSchema = exports.userInputSchema = exports.semesterInputSchema = exports.academicYearInputSchema = exports.courseInputSchema = exports.departmentInputSchema = exports.institutionInputSchema = exports.guardianContactInputSchema = exports.generatedImageSchema = exports.quizAttemptSchema = exports.quizSchema = exports.diagramSchema = exports.mindMapSchema = exports.flashcardReviewSchema = exports.flashcardSchema = exports.flashcardDeckSchema = exports.studyMaterialSchema = exports.subjectResourceSchema = exports.auditLogSchema = exports.guardianContactSchema = exports.studentAchievementSchema = exports.submissionAttachmentSchema = exports.assignmentSubmissionSchema = void 0;
exports.generatedImageInputSchema = exports.quizAttemptInputSchema = exports.quizInputSchema = exports.diagramInputSchema = exports.mindMapInputSchema = exports.flashcardReviewInputSchema = exports.flashcardInputSchema = exports.flashcardDeckInputSchema = exports.studyMaterialInputSchema = exports.subjectResourceInputSchema = exports.auditLogInputSchema = exports.studentAchievementInputSchema = exports.submissionAttachmentInputSchema = exports.assignmentSubmissionInputSchema = exports.assignmentAttachmentInputSchema = exports.assignmentInputSchema = exports.assessmentResultInputSchema = void 0;
var zod_1 = require("zod");
var shared_types_1 = require("@alex/shared-types");
exports.userRoleSchema = zod_1.z.nativeEnum(shared_types_1.UserRole);
exports.membershipStatusSchema = zod_1.z.nativeEnum(shared_types_1.MembershipStatus);
exports.documentStatusSchema = zod_1.z.nativeEnum(shared_types_1.DocumentStatus);
exports.documentTypeSchema = zod_1.z.nativeEnum(shared_types_1.DocumentType);
exports.attendanceStatusSchema = zod_1.z.nativeEnum(shared_types_1.AttendanceStatus);
exports.assessmentTypeSchema = zod_1.z.nativeEnum(shared_types_1.AssessmentType);
exports.assignmentStatusSchema = zod_1.z.nativeEnum(shared_types_1.AssignmentStatus);
exports.achievementCategorySchema = zod_1.z.nativeEnum(shared_types_1.AchievementCategory);
exports.notificationCategorySchema = zod_1.z.nativeEnum(shared_types_1.NotificationCategory);
exports.projectStatusSchema = zod_1.z.nativeEnum(shared_types_1.ProjectStatus);
exports.projectRoleSchema = zod_1.z.nativeEnum(shared_types_1.ProjectRole);
exports.memoryCategorySchema = zod_1.z.nativeEnum(shared_types_1.MemoryCategory);
exports.aiProviderTypeSchema = zod_1.z.nativeEnum(shared_types_1.AIProviderType);
exports.institutionSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z.string().min(1).max(50),
    domain: zod_1.z.string().url().nullable().optional(),
    address: zod_1.z.string().max(500).nullable().optional(),
    phone: zod_1.z.string().max(50).nullable().optional(),
    email: zod_1.z.string().email().nullable().optional(),
    logoUrl: zod_1.z.string().url().nullable().optional(),
    settings: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.departmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z.string().min(1).max(50),
    institutionId: zod_1.z.string().cuid(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.courseSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z.string().min(1).max(50),
    institutionId: zod_1.z.string().cuid(),
    departmentId: zod_1.z.string().cuid(),
    durationYears: zod_1.z.number().int().positive(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.academicYearSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(100),
    institutionId: zod_1.z.string().cuid(),
    startDate: zod_1.z.date(),
    endDate: zod_1.z.date(),
    isActive: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.semesterSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(100),
    number: zod_1.z.number().int().positive(),
    institutionId: zod_1.z.string().cuid(),
    academicYearId: zod_1.z.string().cuid(),
    courseId: zod_1.z.string().cuid(),
    startDate: zod_1.z.date(),
    endDate: zod_1.z.date(),
    isActive: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.userSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    email: zod_1.z.string().email(),
    emailVerified: zod_1.z.date().nullable().optional(),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    role: exports.userRoleSchema,
    isActive: zod_1.z.boolean(),
    lastLoginAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.collegeMembershipSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    institutionId: zod_1.z.string().cuid(),
    departmentId: zod_1.z.string().cuid().nullable().optional(),
    courseId: zod_1.z.string().cuid().nullable().optional(),
    semesterId: zod_1.z.string().cuid().nullable().optional(),
    academicYearId: zod_1.z.string().cuid().nullable().optional(),
    role: exports.userRoleSchema,
    status: exports.membershipStatusSchema,
    studentId: zod_1.z.string().max(50).nullable().optional(),
    employeeId: zod_1.z.string().max(50).nullable().optional(),
    enrolledAt: zod_1.z.date(),
    verifiedAt: zod_1.z.date().nullable().optional(),
    verifiedBy: zod_1.z.string().cuid().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.subjectSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z.string().min(1).max(50),
    institutionId: zod_1.z.string().cuid(),
    departmentId: zod_1.z.string().cuid(),
    semesterId: zod_1.z.string().cuid(),
    credits: zod_1.z.number().int().positive().default(3),
    description: zod_1.z.string().max(2000).nullable().optional(),
    syllabus: zod_1.z.string().max(10000).nullable().optional(),
    textbooks: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.subjectEnrollmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    semesterId: zod_1.z.string().cuid(),
    enrolledAt: zod_1.z.date(),
    isActive: zod_1.z.boolean().default(true),
});
exports.lecturerAssignmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    assignedAt: zod_1.z.date(),
    assignedBy: zod_1.z.string().cuid().nullable().optional(),
    isPrimary: zod_1.z.boolean().default(false),
});
exports.documentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    fileName: zod_1.z.string().min(1).max(255),
    fileSize: zod_1.z.bigint(),
    mimeType: zod_1.z.string().min(1).max(100),
    documentType: exports.documentTypeSchema,
    storagePath: zod_1.z.string().min(1).max(500),
    storageBucket: zod_1.z.string().min(1).max(100).default('documents'),
    checksum: zod_1.z.string().min(1).max(128),
    status: exports.documentStatusSchema.default(shared_types_1.DocumentStatus.UPLOADED),
    errorMessage: zod_1.z.string().max(2000).nullable().optional(),
    pageCount: zod_1.z.number().int().positive().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    ownerId: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    projectId: zod_1.z.string().cuid().nullable().optional(),
    notebookId: zod_1.z.string().cuid().nullable().optional(),
    processorId: zod_1.z.string().cuid().nullable().optional(),
    processedAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.documentChunkSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    documentId: zod_1.z.string().cuid(),
    content: zod_1.z.string(),
    chunkIndex: zod_1.z.number().int().nonnegative(),
    pageNumber: zod_1.z.number().int().positive().nullable().optional(),
    sectionTitle: zod_1.z.string().max(500).nullable().optional(),
    tokenCount: zod_1.z.number().int().positive(),
    embedding: zod_1.z.instanceof(Uint8Array).nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.documentProcessingJobSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    documentId: zod_1.z.string().cuid(),
    step: zod_1.z.string().min(1).max(100),
    status: exports.documentStatusSchema,
    startedAt: zod_1.z.date().nullable().optional(),
    completedAt: zod_1.z.date().nullable().optional(),
    errorMessage: zod_1.z.string().max(2000).nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.conversationSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    title: zod_1.z.string().max(500).nullable().optional(),
    userId: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid().nullable().optional(),
    notebookId: zod_1.z.string().cuid().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.messageSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    conversationId: zod_1.z.string().cuid(),
    senderId: zod_1.z.string().cuid(),
    role: zod_1.z.string().min(1).max(50),
    content: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    toolCalls: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    toolResults: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.userMemorySchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    category: exports.memoryCategorySchema,
    key: zod_1.z.string().min(1).max(255),
    value: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1).default(1),
    source: zod_1.z.string().max(500).nullable().optional(),
    isVerified: zod_1.z.boolean().default(false),
    expiresAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.taskSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    assigneeId: zod_1.z.string().cuid(),
    creatorId: zod_1.z.string().cuid(),
    dueDate: zod_1.z.date().nullable().optional(),
    completedAt: zod_1.z.date().nullable().optional(),
    isCompleted: zod_1.z.boolean().default(false),
    priority: zod_1.z.number().int().default(0),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.plannerEventSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    startTime: zod_1.z.date(),
    endTime: zod_1.z.date(),
    allDay: zod_1.z.boolean().default(false),
    eventType: zod_1.z.string().min(1).max(100),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    taskId: zod_1.z.string().cuid().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.notificationSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    category: exports.notificationCategorySchema,
    title: zod_1.z.string().min(1).max(500),
    message: zod_1.z.string().min(1).max(2000),
    referenceId: zod_1.z.string().cuid().nullable().optional(),
    referenceType: zod_1.z.string().max(100).nullable().optional(),
    isRead: zod_1.z.boolean().default(false),
    readAt: zod_1.z.date().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.notificationPreferenceSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    category: exports.notificationCategorySchema,
    inAppEnabled: zod_1.z.boolean().default(true),
    emailEnabled: zod_1.z.boolean().default(false),
    pushEnabled: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.aiCredentialSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    provider: exports.aiProviderTypeSchema,
    providerName: zod_1.z.string().min(1).max(100),
    encryptedKey: zod_1.z.string().min(1),
    keyHash: zod_1.z.string().min(1).max(128),
    isActive: zod_1.z.boolean().default(true),
    isDefault: zod_1.z.boolean().default(false),
    models: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    usageLimit: zod_1.z.number().int().positive().nullable().optional(),
    usageCount: zod_1.z.number().int().nonnegative().default(0),
    lastUsedAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.aiModelConfigSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    provider: exports.aiProviderTypeSchema,
    modelId: zod_1.z.string().min(1).max(255),
    taskType: zod_1.z.string().min(1).max(100),
    isDefault: zod_1.z.boolean().default(false),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.researchNotebookSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    ownerId: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid().nullable().optional(),
    isPublic: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.researchSourceSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    notebookId: zod_1.z.string().cuid(),
    documentId: zod_1.z.string().cuid().nullable().optional(),
    title: zod_1.z.string().min(1).max(500),
    authors: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    publicationYear: zod_1.z.number().int().positive().nullable().optional(),
    doi: zod_1.z.string().max(255).nullable().optional(),
    url: zod_1.z.string().url().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.researchNoteSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    notebookId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    content: zod_1.z.string(),
    sourceIds: zod_1.z.array(zod_1.z.string().cuid()),
    tags: zod_1.z.array(zod_1.z.string().max(50)),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.projectSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    category: zod_1.z.string().max(100).nullable().optional(),
    tags: zod_1.z.array(zod_1.z.string().max(50)),
    ownerId: zod_1.z.string().cuid(),
    status: exports.projectStatusSchema.default(shared_types_1.ProjectStatus.PLANNING),
    startDate: zod_1.z.date().nullable().optional(),
    endDate: zod_1.z.date().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.projectMemberSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    role: exports.projectRoleSchema.default(shared_types_1.ProjectRole.MEMBER),
    joinedAt: zod_1.z.date(),
    invitedBy: zod_1.z.string().cuid().nullable().optional(),
});
exports.projectMentorSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    assignedAt: zod_1.z.date(),
    assignedBy: zod_1.z.string().cuid().nullable().optional(),
});
exports.projectTaskSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    assigneeId: zod_1.z.string().cuid().nullable().optional(),
    creatorId: zod_1.z.string().cuid(),
    status: zod_1.z.string().min(1).max(50).default('TODO'),
    priority: zod_1.z.number().int().default(0),
    dueDate: zod_1.z.date().nullable().optional(),
    completedAt: zod_1.z.date().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.projectMilestoneSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).nullable().optional(),
    dueDate: zod_1.z.date(),
    completedAt: zod_1.z.date().nullable().optional(),
    isCompleted: zod_1.z.boolean().default(false),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.projectDiscussionSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    projectId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(500),
    content: zod_1.z.string(),
    parentId: zod_1.z.string().cuid().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.attendanceSessionSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    semesterId: zod_1.z.string().cuid(),
    date: zod_1.z.date(),
    period: zod_1.z.number().int().positive(),
    topic: zod_1.z.string().max(500).nullable().optional(),
    conductedBy: zod_1.z.string().cuid(),
    isCancelled: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.attendanceRecordSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    sessionId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    status: exports.attendanceStatusSchema,
    markedBy: zod_1.z.string().cuid(),
    markedAt: zod_1.z.date(),
    notes: zod_1.z.string().max(1000).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.assessmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    semesterId: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    type: exports.assessmentTypeSchema,
    maxMarks: zod_1.z.number().int().positive(),
    weight: zod_1.z.number().positive().default(1),
    assessmentDate: zod_1.z.date(),
    description: zod_1.z.string().max(2000).nullable().optional(),
    isPublished: zod_1.z.boolean().default(false),
    publishedAt: zod_1.z.date().nullable().optional(),
    createdBy: zod_1.z.string().cuid(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.assessmentResultSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    assessmentId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    marksObtained: zod_1.z.number(),
    feedback: zod_1.z.string().max(2000).nullable().optional(),
    gradedBy: zod_1.z.string().cuid().nullable().optional(),
    gradedAt: zod_1.z.date().nullable().optional(),
    isPublished: zod_1.z.boolean().default(false),
    publishedAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.assignmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(2000).nullable().optional(),
    instructions: zod_1.z.string().max(5000).nullable().optional(),
    maxMarks: zod_1.z.number().int().positive(),
    weight: zod_1.z.number().positive().default(1),
    assignedDate: zod_1.z.date(),
    dueDate: zod_1.z.date(),
    allowedFormats: zod_1.z.array(zod_1.z.string().max(50)),
    allowResubmission: zod_1.z.boolean().default(false),
    maxSubmissions: zod_1.z.number().int().positive().default(1),
    isPublished: zod_1.z.boolean().default(false),
    createdBy: zod_1.z.string().cuid(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.assignmentAttachmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    assignmentId: zod_1.z.string().cuid(),
    fileName: zod_1.z.string().min(1).max(255),
    storagePath: zod_1.z.string().min(1).max(500),
    fileSize: zod_1.z.bigint(),
    mimeType: zod_1.z.string().min(1).max(100),
    createdAt: zod_1.z.date(),
});
exports.assignmentSubmissionSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    assignmentId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    status: exports.assignmentStatusSchema.default(shared_types_1.AssignmentStatus.DRAFT),
    submissionNumber: zod_1.z.number().int().positive().default(1),
    content: zod_1.z.string().nullable().optional(),
    submittedAt: zod_1.z.date().nullable().optional(),
    gradedAt: zod_1.z.date().nullable().optional(),
    marksObtained: zod_1.z.number().nullable().optional(),
    feedback: zod_1.z.string().max(2000).nullable().optional(),
    gradedBy: zod_1.z.string().cuid().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.submissionAttachmentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    submissionId: zod_1.z.string().cuid(),
    fileName: zod_1.z.string().min(1).max(255),
    storagePath: zod_1.z.string().min(1).max(500),
    fileSize: zod_1.z.bigint(),
    mimeType: zod_1.z.string().min(1).max(100),
    createdAt: zod_1.z.date(),
});
exports.studentAchievementSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    category: exports.achievementCategorySchema,
    organization: zod_1.z.string().max(255).nullable().optional(),
    startDate: zod_1.z.date().nullable().optional(),
    endDate: zod_1.z.date().nullable().optional(),
    description: zod_1.z.string().max(2000).nullable().optional(),
    status: zod_1.z.string().max(50).default('COMPLETED'),
    verificationStatus: zod_1.z.string().max(50).default('UNVERIFIED'),
    verifiedBy: zod_1.z.string().cuid().nullable().optional(),
    verifiedAt: zod_1.z.date().nullable().optional(),
    certificateUrl: zod_1.z.string().url().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.guardianContactSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    institutionId: zod_1.z.string().cuid(),
    studentId: zod_1.z.string().cuid(),
    name: zod_1.z.string().min(1).max(255),
    relationship: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email().nullable().optional(),
    phone: zod_1.z.string().max(50).nullable().optional(),
    whatsapp: zod_1.z.string().max(50).nullable().optional(),
    isPrimary: zod_1.z.boolean().default(false),
    consentGiven: zod_1.z.boolean().default(false),
    consentAt: zod_1.z.date().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.auditLogSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    institutionId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid().nullable().optional(),
    action: zod_1.z.string().min(1).max(100),
    entityType: zod_1.z.string().min(1).max(100),
    entityId: zod_1.z.string().cuid().nullable().optional(),
    oldValues: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    newValues: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    ipAddress: zod_1.z.string().max(45).nullable().optional(),
    userAgent: zod_1.z.string().max(500).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.subjectResourceSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    subjectId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).nullable().optional(),
    category: zod_1.z.string().min(1).max(100),
    fileName: zod_1.z.string().min(1).max(255),
    storagePath: zod_1.z.string().min(1).max(500),
    fileSize: zod_1.z.bigint(),
    mimeType: zod_1.z.string().min(1).max(100),
    version: zod_1.z.number().int().positive().default(1),
    isPublished: zod_1.z.boolean().default(false),
    publishedAt: zod_1.z.date().nullable().optional(),
    uploadedBy: zod_1.z.string().cuid(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.studyMaterialSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    content: zod_1.z.string(),
    type: zod_1.z.string().min(1).max(100),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    topic: zod_1.z.string().max(255).nullable().optional(),
    tags: zod_1.z.array(zod_1.z.string().max(50)),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.flashcardDeckSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    algorithm: zod_1.z.string().min(1).max(50).default('SM2'),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.flashcardSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    deckId: zod_1.z.string().cuid(),
    front: zod_1.z.string(),
    back: zod_1.z.string(),
    difficulty: zod_1.z.number().default(0),
    interval: zod_1.z.number().int().nonnegative().default(0),
    repetitions: zod_1.z.number().int().nonnegative().default(0),
    easeFactor: zod_1.z.number().default(2.5),
    nextReview: zod_1.z.date(),
    lastReviewed: zod_1.z.date().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.flashcardReviewSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    cardId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    rating: zod_1.z.number().int().min(0).max(5),
    previousEase: zod_1.z.number(),
    newEase: zod_1.z.number(),
    previousInterval: zod_1.z.number().int(),
    newInterval: zod_1.z.number().int(),
    reviewedAt: zod_1.z.date(),
});
exports.mindMapSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    topic: zod_1.z.string().max(255).nullable().optional(),
    nodes: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    edges: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    viewport: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.diagramSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    type: zod_1.z.string().min(1).max(100),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    definition: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    renderedUrl: zod_1.z.string().url().nullable().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.quizSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    topic: zod_1.z.string().max(255).nullable().optional(),
    difficulty: zod_1.z.string().min(1).max(50),
    questions: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    timeLimit: zod_1.z.number().int().positive().nullable().optional(),
    isPublished: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.quizAttemptSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    quizId: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    score: zod_1.z.number(),
    maxScore: zod_1.z.number(),
    startedAt: zod_1.z.date(),
    completedAt: zod_1.z.date().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
});
exports.generatedImageSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    userId: zod_1.z.string().cuid(),
    prompt: zod_1.z.string().min(1).max(2000),
    sourceDocId: zod_1.z.string().cuid().nullable().optional(),
    subjectId: zod_1.z.string().cuid().nullable().optional(),
    imageUrl: zod_1.z.string().url(),
    model: zod_1.z.string().min(1).max(100),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.guardianContactInputSchema = exports.guardianContactSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.institutionInputSchema = exports.institutionSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.departmentInputSchema = exports.departmentSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.courseInputSchema = exports.courseSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.academicYearInputSchema = exports.academicYearSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.semesterInputSchema = exports.semesterSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.userInputSchema = exports.userSchema.omit({ id: true, createdAt: true, updatedAt: true, emailVerified: true, lastLoginAt: true });
exports.collegeMembershipInputSchema = exports.collegeMembershipSchema.omit({ id: true, createdAt: true, updatedAt: true, enrolledAt: true, verifiedAt: true });
exports.subjectInputSchema = exports.subjectSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.subjectEnrollmentInputSchema = exports.subjectEnrollmentSchema.omit({ id: true, enrolledAt: true });
exports.lecturerAssignmentInputSchema = exports.lecturerAssignmentSchema.omit({ id: true, assignedAt: true });
exports.documentInputSchema = exports.documentSchema.omit({ id: true, createdAt: true, updatedAt: true, processedAt: true });
exports.documentChunkInputSchema = exports.documentChunkSchema.omit({ id: true, createdAt: true });
exports.documentProcessingJobInputSchema = exports.documentProcessingJobSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.conversationInputSchema = exports.conversationSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.messageInputSchema = exports.messageSchema.omit({ id: true, createdAt: true });
exports.userMemoryInputSchema = exports.userMemorySchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.taskInputSchema = exports.taskSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.plannerEventInputSchema = exports.plannerEventSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.notificationInputSchema = exports.notificationSchema.omit({ id: true, createdAt: true, readAt: true });
exports.notificationPreferenceInputSchema = exports.notificationPreferenceSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.aiCredentialInputSchema = exports.aiCredentialSchema.omit({ id: true, createdAt: true, updatedAt: true, lastUsedAt: true });
exports.aiModelConfigInputSchema = exports.aiModelConfigSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.researchNotebookInputSchema = exports.researchNotebookSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.researchSourceInputSchema = exports.researchSourceSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.researchNoteInputSchema = exports.researchNoteSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.projectInputSchema = exports.projectSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.projectMemberInputSchema = exports.projectMemberSchema.omit({ id: true, joinedAt: true });
exports.projectMentorInputSchema = exports.projectMentorSchema.omit({ id: true, assignedAt: true });
exports.projectTaskInputSchema = exports.projectTaskSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.projectMilestoneInputSchema = exports.projectMilestoneSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.projectDiscussionInputSchema = exports.projectDiscussionSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.attendanceSessionInputSchema = exports.attendanceSessionSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.attendanceRecordInputSchema = exports.attendanceRecordSchema.omit({ id: true, createdAt: true, updatedAt: true, markedAt: true });
exports.assessmentInputSchema = exports.assessmentSchema.omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
exports.assessmentResultInputSchema = exports.assessmentResultSchema.omit({ id: true, createdAt: true, updatedAt: true, gradedAt: true, publishedAt: true });
exports.assignmentInputSchema = exports.assignmentSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.assignmentAttachmentInputSchema = exports.assignmentAttachmentSchema.omit({ id: true, createdAt: true });
exports.assignmentSubmissionInputSchema = exports.assignmentSubmissionSchema.omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, gradedAt: true });
exports.submissionAttachmentInputSchema = exports.submissionAttachmentSchema.omit({ id: true, createdAt: true });
exports.studentAchievementInputSchema = exports.studentAchievementSchema.omit({ id: true, createdAt: true, updatedAt: true, verifiedAt: true });
exports.auditLogInputSchema = exports.auditLogSchema.omit({ id: true, createdAt: true });
exports.subjectResourceInputSchema = exports.subjectResourceSchema.omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
exports.studyMaterialInputSchema = exports.studyMaterialSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.flashcardDeckInputSchema = exports.flashcardDeckSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.flashcardInputSchema = exports.flashcardSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.flashcardReviewInputSchema = exports.flashcardReviewSchema.omit({ id: true, reviewedAt: true });
exports.mindMapInputSchema = exports.mindMapSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.diagramInputSchema = exports.diagramSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.quizInputSchema = exports.quizSchema.omit({ id: true, createdAt: true, updatedAt: true });
exports.quizAttemptInputSchema = exports.quizAttemptSchema.omit({ id: true, startedAt: true, completedAt: true });
exports.generatedImageInputSchema = exports.generatedImageSchema.omit({ id: true, createdAt: true });
