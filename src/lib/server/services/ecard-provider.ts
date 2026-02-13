import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import type { CertificationCode } from '$lib/types';

export interface NameEmailLookupInput {
	organizationId: string;
	siteCode: string;
	firstName: string;
	middleName?: string | null;
	lastName: string;
	email: string;
}

export interface FoundEcard {
	certCode: CertificationCode;
	ecardCode: string;
}

export interface VerifyBatchEntry {
	ecardEntryId: string;
	ecardCode: string;
}

export interface BatchResult {
	ecardEntryId: string;
	status: 'verified' | 'failed';
	error?: string;
}

export interface EcardProviderClient {
	lookupEcardsByNameEmail(input: NameEmailLookupInput): Promise<FoundEcard[]>;
	verifyEcardBatch(entries: VerifyBatchEntry[]): Promise<BatchResult[]>;
}

function makeDeterministicCode(seed: string, certCode: CertificationCode): string {
	const compact = seed
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 10)
		.padEnd(10, 'x');
	return `${certCode}-${compact}`.toUpperCase();
}

class NoopEcardProviderClient implements EcardProviderClient {
	async lookupEcardsByNameEmail(input: NameEmailLookupInput): Promise<FoundEcard[]> {
		const seed = `${input.firstName}${input.lastName}${input.email}`;
		return FIXED_CERTIFICATION_CODES.map((certCode) => ({
			certCode,
			ecardCode: makeDeterministicCode(seed, certCode)
		}));
	}

	async verifyEcardBatch(entries: VerifyBatchEntry[]): Promise<BatchResult[]> {
		return entries.map((entry) => ({
			ecardEntryId: entry.ecardEntryId,
			status: 'verified'
		}));
	}
}

export const ecardProviderClient: EcardProviderClient = new NoopEcardProviderClient();
