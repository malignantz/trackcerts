import type { CertificationCode } from '$lib/types';
import { getDb, staff, staffCertificationRequirements } from '$lib/server/db';
import { and, eq, ilike, isNull } from 'drizzle-orm';

export interface ImportStaffRow {
	firstName: string;
	middleName: string | null;
	lastName: string;
	requiredCertCodes: CertificationCode[];
}

function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function firstLastKey(firstName: string, lastName: string): string {
	return `${normalizeName(firstName)}|${normalizeName(lastName)}`;
}

function fullNameKey(firstName: string, middleName: string | null, lastName: string): string {
	return `${normalizeName(firstName)}|${normalizeName(middleName ?? '')}|${normalizeName(lastName)}`;
}

async function assertMiddleNameOnCollisions(
	organizationId: string,
	rows: ImportStaffRow[]
): Promise<void> {
	const db = getDb();
	const dedupedFirstLast = new Map<string, ImportStaffRow[]>();
	for (const row of rows) {
		const key = firstLastKey(row.firstName, row.lastName);
		if (!dedupedFirstLast.has(key)) {
			dedupedFirstLast.set(key, []);
		}
		dedupedFirstLast.get(key)?.push(row);
	}

	for (const [_, groupedRows] of dedupedFirstLast) {
		const sample = groupedRows[0];
		const existing = await db
			.select({
				id: staff.id,
				middleName: staff.middleName
			})
			.from(staff)
			.where(
				and(
					eq(staff.organizationId, organizationId),
					ilike(staff.firstName, sample.firstName),
					ilike(staff.lastName, sample.lastName)
				)
			);

		const totalCount = existing.length + groupedRows.length;
		if (totalCount > 1) {
			const hasMissingMiddle =
				groupedRows.some((row) => !row.middleName?.trim()) ||
				existing.some((row) => !row.middleName?.trim());
			if (hasMissingMiddle) {
				throw new Error(
					`Middle name/initial required for duplicate staff name ${sample.firstName} ${sample.lastName}.`
				);
			}
		}
	}
}

export async function importStaffRowsWithRequirements(
	organizationId: string,
	rows: ImportStaffRow[]
): Promise<{ insertedCount: number }> {
	const db = getDb();
	const deduped = new Map<string, ImportStaffRow>();
	for (const row of rows) {
		const key = fullNameKey(row.firstName, row.middleName, row.lastName);
		deduped.set(key, row);
	}

	const finalRows = [...deduped.values()];
	await assertMiddleNameOnCollisions(organizationId, finalRows);

	let insertedCount = 0;
	await db.transaction(async (tx) => {
		for (const row of finalRows) {
			const [existingStaff] = await tx
				.select({ id: staff.id })
				.from(staff)
				.where(
					and(
						eq(staff.organizationId, organizationId),
						ilike(staff.firstName, row.firstName),
						ilike(staff.lastName, row.lastName),
						row.middleName ? ilike(staff.middleName, row.middleName) : isNull(staff.middleName)
					)
				)
				.limit(1);

			const staffId = existingStaff
				? existingStaff.id
				: (
						await tx
							.insert(staff)
							.values({
								organizationId,
								firstName: row.firstName,
								middleName: row.middleName,
								lastName: row.lastName,
								isActive: true
							})
							.returning({ id: staff.id })
					)[0]?.id;

			if (!existingStaff && staffId) {
				insertedCount += 1;
			}

			if (!staffId) {
				continue;
			}

			await tx
				.delete(staffCertificationRequirements)
				.where(
					and(
						eq(staffCertificationRequirements.organizationId, organizationId),
						eq(staffCertificationRequirements.staffId, staffId)
					)
				);

			if (row.requiredCertCodes.length > 0) {
				await tx.insert(staffCertificationRequirements).values(
					row.requiredCertCodes.map((certCode) => ({
						organizationId,
						staffId,
						certCode,
						isRequired: true
					}))
				);
			}
		}
	});

	return { insertedCount };
}

export async function clearStaffForOrganizationTesting(
	organizationId: string
): Promise<{ deletedCount: number }> {
	const db = getDb();

	return db.transaction(async (tx) => {
		await tx
			.delete(staffCertificationRequirements)
			.where(eq(staffCertificationRequirements.organizationId, organizationId));

		const deleted = await tx
			.delete(staff)
			.where(eq(staff.organizationId, organizationId))
			.returning({ id: staff.id });

		return { deletedCount: deleted.length };
	});
}
