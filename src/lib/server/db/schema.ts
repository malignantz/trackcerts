import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['owner', 'manager']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'verified', 'failed']);

export const organizations = pgTable(
	'organizations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [unique('organizations_slug_unique').on(table.slug)]
);

export const userProfiles = pgTable(
	'user_profiles',
	{
		id: uuid('id').primaryKey(),
		email: text('email').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [unique('user_profiles_email_unique').on(table.email)]
);

export const organizationMemberships = pgTable(
	'organization_memberships',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => userProfiles.id, { onDelete: 'cascade' }),
		role: roleEnum('role').notNull().default('manager'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		unique('organization_memberships_org_user_unique').on(table.organizationId, table.userId),
		index('organization_memberships_user_active_idx').on(table.userId, table.isActive)
	]
);

export const certificationTypes = pgTable(
	'certification_types',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		label: text('label').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [unique('certification_types_org_code_unique').on(table.organizationId, table.code)]
);

export const staff = pgTable(
	'staff',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		firstName: text('first_name').notNull(),
		lastName: text('last_name').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('staff_org_last_first_idx').on(table.organizationId, table.lastName, table.firstName)
	]
);

export const submissions = pgTable('submissions', {
	id: uuid('id').defaultRandom().primaryKey(),
	organizationId: uuid('organization_id')
		.notNull()
		.references(() => organizations.id, { onDelete: 'cascade' }),
	staffId: uuid('staff_id')
		.notNull()
		.references(() => staff.id, { onDelete: 'restrict' }),
	submittedFirstName: text('submitted_first_name').notNull(),
	submittedLastName: text('submitted_last_name').notNull(),
	status: jobStatusEnum('status').notNull().default('pending'),
	submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const ecardEntries = pgTable('ecard_entries', {
	id: uuid('id').defaultRandom().primaryKey(),
	submissionId: uuid('submission_id')
		.notNull()
		.references(() => submissions.id, { onDelete: 'cascade' }),
	certificationTypeId: uuid('certification_type_id').references(() => certificationTypes.id, {
		onDelete: 'set null'
	}),
	ecardCode: text('ecard_code').notNull(),
	status: jobStatusEnum('status').notNull().default('pending'),
	lastError: text('last_error'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const verificationJobs = pgTable('verification_jobs', {
	id: uuid('id').defaultRandom().primaryKey(),
	ecardEntryId: uuid('ecard_entry_id')
		.notNull()
		.references(() => ecardEntries.id, { onDelete: 'cascade' }),
	status: jobStatusEnum('status').notNull().default('pending'),
	attemptCount: integer('attempt_count').notNull().default(0),
	queuedAt: timestamp('queued_at', { withTimezone: true }).defaultNow().notNull(),
	startedAt: timestamp('started_at', { withTimezone: true }),
	finishedAt: timestamp('finished_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const documents = pgTable('documents', {
	id: uuid('id').defaultRandom().primaryKey(),
	organizationId: uuid('organization_id')
		.notNull()
		.references(() => organizations.id, { onDelete: 'cascade' }),
	staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
	certificationTypeId: uuid('certification_type_id').references(() => certificationTypes.id, {
		onDelete: 'set null'
	}),
	sourceFilePath: text('source_file_path').notNull(),
	stampedFilePath: text('stamped_file_path').notNull(),
	verifiedAt: timestamp('verified_at', { withTimezone: true }),
	checksum: text('checksum').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable('audit_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	organizationId: uuid('organization_id').references(() => organizations.id, {
		onDelete: 'set null'
	}),
	actorType: text('actor_type').notNull(),
	actorId: uuid('actor_id'),
	eventType: text('event_type').notNull(),
	payloadJson: jsonb('payload_json').notNull().default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
	memberships: many(organizationMemberships),
	staff: many(staff),
	certificationTypes: many(certificationTypes)
}));
