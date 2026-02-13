import { and, asc, eq } from 'drizzle-orm';

import { CERTIFICATION_LABELS, FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { certificationTypes, getDb } from '$lib/server/db';
import type { CertificationCode } from '$lib/types';

interface CertificationTypeInput {
	code: string;
	label: string;
}

export async function listCertificationTypes(organizationId: string) {
	const db = getDb();
	return db
		.select({
			id: certificationTypes.id,
			code: certificationTypes.code,
			label: certificationTypes.label,
			isActive: certificationTypes.isActive
		})
		.from(certificationTypes)
		.where(eq(certificationTypes.organizationId, organizationId))
		.orderBy(asc(certificationTypes.code));
}

export async function createCertificationType(
	organizationId: string,
	input: CertificationTypeInput
) {
	const db = getDb();
	await db.insert(certificationTypes).values({
		organizationId,
		code: input.code,
		label: input.label,
		isActive: true
	});
}

export async function updateCertificationType(
	organizationId: string,
	id: string,
	input: CertificationTypeInput
) {
	const db = getDb();
	await db
		.update(certificationTypes)
		.set({
			code: input.code,
			label: input.label,
			updatedAt: new Date()
		})
		.where(
			and(eq(certificationTypes.organizationId, organizationId), eq(certificationTypes.id, id))
		);
}

export async function setCertificationTypeActive(
	organizationId: string,
	id: string,
	isActive: boolean
) {
	const db = getDb();
	await db
		.update(certificationTypes)
		.set({
			isActive,
			updatedAt: new Date()
		})
		.where(
			and(eq(certificationTypes.organizationId, organizationId), eq(certificationTypes.id, id))
		);
}

export async function ensureFixedCertificationTypes(
	organizationId: string
): Promise<Record<CertificationCode, string>> {
	const db = getDb();
	for (const code of FIXED_CERTIFICATION_CODES) {
		await db
			.insert(certificationTypes)
			.values({
				organizationId,
				code,
				label: CERTIFICATION_LABELS[code],
				isActive: true
			})
			.onConflictDoUpdate({
				target: [certificationTypes.organizationId, certificationTypes.code],
				set: {
					label: CERTIFICATION_LABELS[code],
					isActive: true,
					updatedAt: new Date()
				}
			});
	}

	const records = await db
		.select({
			id: certificationTypes.id,
			code: certificationTypes.code
		})
		.from(certificationTypes)
		.where(
			and(
				eq(certificationTypes.organizationId, organizationId),
				eq(certificationTypes.isActive, true)
			)
		);

	const map = {
		ACLS: '',
		BLS: '',
		PALS: ''
	} satisfies Record<CertificationCode, string>;
	for (const record of records) {
		if (FIXED_CERTIFICATION_CODES.includes(record.code as CertificationCode)) {
			map[record.code as CertificationCode] = record.id;
		}
	}

	return map;
}
