import type { CertificationCode } from './types';

export const FIXED_CERTIFICATION_CODES: CertificationCode[] = ['ACLS', 'BLS', 'PALS'];

export const CERTIFICATION_LABELS: Record<CertificationCode, string> = {
	ACLS: 'Advanced Cardiac Life Support',
	BLS: 'Basic Life Support',
	PALS: 'Pediatric Advanced Life Support'
};
