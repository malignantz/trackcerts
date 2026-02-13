import { and, asc, eq, isNotNull } from 'drizzle-orm';

import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { getDb } from '$lib/server/db/client';
import {
	certificationTypes,
	documents,
	staff,
	staffCertificationRequirements
} from '$lib/server/db/schema';
import type { CertificationCode } from '$lib/types';

export interface StaffMatrixRow {
	id: string;
	firstName: string;
	middleName: string | null;
	lastName: string;
	isActive: boolean;
	required: Record<CertificationCode, boolean>;
	verified: Record<CertificationCode, boolean>;
}

function emptyBoolMap(defaultValue = false): Record<CertificationCode, boolean> {
	return {
		ACLS: defaultValue,
		BLS: defaultValue,
		PALS: defaultValue
	};
}

export async function setStaffRequirements(
	organizationId: string,
	staffId: string,
	certCodes: CertificationCode[]
): Promise<void> {
	const db = getDb();
	await db.transaction(async (tx) => {
		await tx
			.delete(staffCertificationRequirements)
			.where(
				and(
					eq(staffCertificationRequirements.organizationId, organizationId),
					eq(staffCertificationRequirements.staffId, staffId)
				)
			);

		if (certCodes.length === 0) {
			return;
		}

		await tx.insert(staffCertificationRequirements).values(
			certCodes.map((certCode) => ({
				organizationId,
				staffId,
				certCode,
				isRequired: true
			}))
		);
	});
}

export async function toggleStaffRequirement(
	organizationId: string,
	staffId: string,
	certCode: CertificationCode,
	isRequired: boolean
): Promise<void> {
	const db = getDb();
	if (!isRequired) {
		await db
			.delete(staffCertificationRequirements)
			.where(
				and(
					eq(staffCertificationRequirements.organizationId, organizationId),
					eq(staffCertificationRequirements.staffId, staffId),
					eq(staffCertificationRequirements.certCode, certCode)
				)
			);
		return;
	}

	await db
		.insert(staffCertificationRequirements)
		.values({
			organizationId,
			staffId,
			certCode,
			isRequired: true
		})
		.onConflictDoUpdate({
			target: [staffCertificationRequirements.staffId, staffCertificationRequirements.certCode],
			set: {
				isRequired: true,
				updatedAt: new Date()
			}
		});
}

export async function getRequiredCertCodesForStaff(
	organizationId: string,
	staffId: string
): Promise<CertificationCode[]> {
	const db = getDb();
	const rows = await db
		.select({ certCode: staffCertificationRequirements.certCode })
		.from(staffCertificationRequirements)
		.where(
			and(
				eq(staffCertificationRequirements.organizationId, organizationId),
				eq(staffCertificationRequirements.staffId, staffId),
				eq(staffCertificationRequirements.isRequired, true)
			)
		);

	return rows.map((row) => row.certCode);
}

export async function listStaffMatrixRows(
	organizationId: string,
	filterCodes: CertificationCode[]
): Promise<StaffMatrixRow[]> {
	const db = getDb();
	const baseRows = await db
		.select({
			id: staff.id,
			firstName: staff.firstName,
			middleName: staff.middleName,
			lastName: staff.lastName,
			isActive: staff.isActive
		})
		.from(staff)
		.where(eq(staff.organizationId, organizationId))
		.orderBy(asc(staff.lastName), asc(staff.firstName), asc(staff.middleName));

	const requirementRows = await db
		.select({
			staffId: staffCertificationRequirements.staffId,
			certCode: staffCertificationRequirements.certCode
		})
		.from(staffCertificationRequirements)
		.where(
			and(
				eq(staffCertificationRequirements.organizationId, organizationId),
				eq(staffCertificationRequirements.isRequired, true)
			)
		);

	const verifiedRows = await db
		.select({
			staffId: documents.staffId,
			certCode: certificationTypes.code
		})
		.from(documents)
		.innerJoin(
			certificationTypes,
			and(
				eq(documents.certificationTypeId, certificationTypes.id),
				eq(certificationTypes.organizationId, organizationId)
			)
		)
		.where(
			and(
				eq(documents.organizationId, organizationId),
				isNotNull(documents.verifiedAt),
				isNotNull(documents.staffId)
			)
		);

	const requirementMap = new Map<string, Set<CertificationCode>>();
	for (const row of requirementRows) {
		if (!requirementMap.has(row.staffId)) {
			requirementMap.set(row.staffId, new Set());
		}
		requirementMap.get(row.staffId)?.add(row.certCode);
	}

	const verifiedMap = new Map<string, Set<CertificationCode>>();
	for (const row of verifiedRows) {
		if (!row.staffId) {
			continue;
		}
		const certCode = row.certCode as CertificationCode;
		if (!FIXED_CERTIFICATION_CODES.includes(certCode)) {
			continue;
		}
		if (!verifiedMap.has(row.staffId)) {
			verifiedMap.set(row.staffId, new Set());
		}
		verifiedMap.get(row.staffId)?.add(certCode);
	}

	const rows = baseRows.map((person) => {
		const requiredSet = requirementMap.get(person.id) ?? new Set<CertificationCode>();
		const verifiedSet = verifiedMap.get(person.id) ?? new Set<CertificationCode>();
		const required = emptyBoolMap();
		const verified = emptyBoolMap();

		for (const certCode of FIXED_CERTIFICATION_CODES) {
			required[certCode] = requiredSet.has(certCode);
			verified[certCode] = requiredSet.has(certCode) && verifiedSet.has(certCode);
		}

		return {
			...person,
			required,
			verified
		};
	});

	if (filterCodes.length === 0) {
		return rows;
	}

	return rows.filter((row) => filterCodes.some((certCode) => row.required[certCode]));
}
