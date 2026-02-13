export type Role = 'owner' | 'manager';

export type JobStatus = 'pending' | 'processing' | 'verified' | 'failed';
export type CertificationCode = 'ACLS' | 'BLS' | 'PALS';

export interface CertificationType {
	id: string;
	organizationId: string;
	code: string;
	label: string;
	isActive: boolean;
}

export interface StaffRecord {
	id: string;
	organizationId: string;
	firstName: string;
	middleName?: string | null;
	lastName: string;
	isActive: boolean;
}

export interface CreateStaffInput {
	firstName: string;
	middleName?: string | null;
	lastName: string;
}

export interface UpdateStaffInput {
	firstName: string;
	middleName?: string | null;
	lastName: string;
	isActive: boolean;
}

export interface StaffRequirementCell {
	certCode: CertificationCode;
	isRequired: boolean;
	isVerified: boolean;
	statusNote?: string;
}

export interface EmployeeSubmissionInput {
	firstName: string;
	middleName?: string | null;
	lastName: string;
	email?: string | null;
	ecardCodes?: Partial<Record<CertificationCode, string>>;
}
