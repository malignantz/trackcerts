import { and, asc, eq } from 'drizzle-orm';

import { certificationTypes, getDb } from '$lib/server/db';

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
