import type { JobStatus } from '$lib/types';

export type VerificationJobType = 'verify_ecard' | 'lookup_name_email';

export type WorkerErrorCategory =
	| 'captcha_detected'
	| 'network_error'
	| 'timeout_error'
	| 'validation_error'
	| 'provider_error'
	| 'no_certs_found';

export interface ProviderLookupCert {
	ecardCode: string;
	providerCertLabel: string;
	certCode?: string | null;
}

export interface LookupProviderInput {
	siteCode: string;
	firstName: string;
	lastName: string;
	email: string;
}

export interface LookupProviderResult {
	certs: ProviderLookupCert[];
}

export interface VerifyBatchInput {
	jobId: string;
	ecardEntryId: string;
	ecardCode: string;
}

export interface VerifyBatchResult {
	jobId: string;
	ecardEntryId: string;
	status: Extract<JobStatus, 'verified' | 'failed'>;
	errorMessage?: string;
	errorCategory?: WorkerErrorCategory;
}

export interface ClaimedVerificationJob {
	id: string;
	jobType: VerificationJobType;
	submissionId: string;
	ecardEntryId: string | null;
	organizationId: string;
	sourceSiteCode: string;
	submittedFirstName: string;
	submittedLastName: string;
	submittedEmail: string | null;
	ecardCode: string | null;
	queuedAt: Date;
	attemptCount: number;
}

export interface JobCompletionResult {
	jobId: string;
	status: Extract<JobStatus, 'verified' | 'failed'>;
	errorMessage?: string;
	errorCategory?: WorkerErrorCategory;
}
