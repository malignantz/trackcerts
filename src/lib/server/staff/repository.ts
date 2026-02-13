import { and, asc, eq, ilike, or } from 'drizzle-orm';

import { getDb, staff } from '$lib/server/db';
import type { CreateStaffInput, UpdateStaffInput } from '$lib/types';

interface ListStaffInput {
	organizationId: string;
	search?: string;
}

export async function listStaff(input: ListStaffInput) {
	const db = getDb();

	const query = db
		.select({
			id: staff.id,
			firstName: staff.firstName,
			middleName: staff.middleName,
			lastName: staff.lastName,
			isActive: staff.isActive,
			createdAt: staff.createdAt
		})
		.from(staff)
		.where(
			and(
				eq(staff.organizationId, input.organizationId),
				input.search && input.search.trim().length > 0
					? or(
							ilike(staff.firstName, `%${input.search.trim()}%`),
							ilike(staff.lastName, `%${input.search.trim()}%`)
						)
					: undefined
			)
		)
		.orderBy(asc(staff.lastName), asc(staff.firstName));

	return query;
}

export async function getStaffById(organizationId: string, staffId: string) {
	const db = getDb();
	const [record] = await db
		.select({
			id: staff.id,
			firstName: staff.firstName,
			middleName: staff.middleName,
			lastName: staff.lastName,
			isActive: staff.isActive
		})
		.from(staff)
		.where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId)))
		.limit(1);

	return record ?? null;
}

export async function createStaffRecord(organizationId: string, input: CreateStaffInput) {
	const db = getDb();
	await db.insert(staff).values({
		organizationId,
		firstName: input.firstName,
		middleName: input.middleName?.trim() || null,
		lastName: input.lastName,
		isActive: true
	});
}

export async function updateStaffRecord(
	organizationId: string,
	staffId: string,
	input: UpdateStaffInput
) {
	const db = getDb();
	await db
		.update(staff)
		.set({
			firstName: input.firstName,
			middleName: input.middleName?.trim() || null,
			lastName: input.lastName,
			isActive: input.isActive,
			updatedAt: new Date()
		})
		.where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId)));
}

interface StaffNameMatchInput {
	organizationId: string;
	firstName: string;
	lastName: string;
	middleName?: string | null;
	activeOnly?: boolean;
}

export async function findStaffByName(input: StaffNameMatchInput) {
	const db = getDb();
	const normalizedMiddle = input.middleName?.trim();
	return db
		.select({
			id: staff.id,
			firstName: staff.firstName,
			middleName: staff.middleName,
			lastName: staff.lastName,
			isActive: staff.isActive
		})
		.from(staff)
		.where(
			and(
				eq(staff.organizationId, input.organizationId),
				ilike(staff.firstName, input.firstName.trim()),
				ilike(staff.lastName, input.lastName.trim()),
				normalizedMiddle ? ilike(staff.middleName, normalizedMiddle) : undefined,
				input.activeOnly ? eq(staff.isActive, true) : undefined
			)
		)
		.orderBy(asc(staff.lastName), asc(staff.firstName), asc(staff.middleName));
}

export async function listPotentialNameCollisions(
	organizationId: string,
	firstName: string,
	lastName: string
) {
	const db = getDb();
	return db
		.select({
			id: staff.id,
			firstName: staff.firstName,
			middleName: staff.middleName,
			lastName: staff.lastName
		})
		.from(staff)
		.where(
			and(
				eq(staff.organizationId, organizationId),
				ilike(staff.firstName, firstName.trim()),
				ilike(staff.lastName, lastName.trim())
			)
		);
}
