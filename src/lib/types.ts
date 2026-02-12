export type Role = 'owner' | 'manager';

export type JobStatus = 'pending' | 'processing' | 'verified' | 'failed';

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
	lastName: string;
	isActive: boolean;
}

export interface CreateStaffInput {
	firstName: string;
	lastName: string;
}

export interface UpdateStaffInput {
	firstName: string;
	lastName: string;
	isActive: boolean;
}
