export interface CertificateProcessor {
	stampDocument(documentId: string): Promise<void>;
}

class NoopCertificateProcessor implements CertificateProcessor {
	async stampDocument(documentId: string): Promise<void> {
		console.warn('NoopCertificateProcessor.stampDocument called', { documentId });
	}
}

export const certificateProcessor: CertificateProcessor = new NoopCertificateProcessor();
