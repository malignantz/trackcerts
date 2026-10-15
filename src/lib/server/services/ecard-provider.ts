import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { getServerEnv } from '$lib/server/env';
import type { CertificationCode } from '$lib/types';
import type {
	LookupProviderInput,
	LookupProviderResult,
	VerifyBatchInput,
	VerifyBatchResult,
	WorkerErrorCategory
} from '$lib/server/worker/types';

interface HeartSelectorMap {
	loginEmail: string[];
	loginPassword: string[];
	loginSubmit: string[];
	employerToggle: string[];
	employerCodesInput: string[];
	employerSubmit: string[];
	lookupFirstName: string[];
	lookupLastName: string[];
	lookupEmail: string[];
	lookupSubmit: string[];
	resultsRow: string[];
	resultCertLabel: string[];
	resultCode: string[];
	captchaSignals: string[];
}

const HEART_SELECTORS: HeartSelectorMap = {
	loginEmail: ['input[type="email"]', 'input[name="email"]', '#email'],
	loginPassword: ['input[type="password"]', 'input[name="password"]', '#password'],
	loginSubmit: ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Log in")'],
	employerToggle: ['a:has-text("Employer")', 'button:has-text("Employer")'],
	employerCodesInput: ['textarea[name="ecards"]', 'textarea', 'input[name="ecardCode"]'],
	employerSubmit: ['button:has-text("Verify")', 'button[type="submit"]'],
	lookupFirstName: ['input[name="firstName"]', '#firstName', 'input[placeholder*="First"]'],
	lookupLastName: ['input[name="lastName"]', '#lastName', 'input[placeholder*="Last"]'],
	lookupEmail: ['input[name="email"]', '#email', 'input[type="email"]'],
	lookupSubmit: ['button:has-text("Search")', 'button:has-text("Find")', 'button[type="submit"]'],
	resultsRow: ['table tbody tr', '.results-table tr', '[data-testid="result-row"]'],
	resultCertLabel: ['[data-cert-label]', '.cert-label', 'td:nth-child(1)'],
	resultCode: ['[data-ecard-code]', '.ecard-code', 'td:nth-child(2)'],
	captchaSignals: ['iframe[src*="captcha"]', 'text=/captcha/i', 'text=/not a robot/i']
};

function makeDeterministicCode(seed: string, certCode: CertificationCode): string {
	const compact = seed
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 10)
		.padEnd(10, 'x');
	return `${certCode}-${compact}`.toUpperCase();
}

function classifyProviderError(error: unknown): WorkerErrorCategory {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	if (message.includes('captcha')) {
		return 'captcha_detected';
	}
	if (message.includes('timeout')) {
		return 'timeout_error';
	}
	if (
		message.includes('network') ||
		message.includes('econn') ||
		message.includes('enotfound') ||
		message.includes('socket')
	) {
		return 'network_error';
	}
	if (message.includes('validation') || message.includes('selector')) {
		return 'validation_error';
	}
	return 'provider_error';
}

export class ProviderAutomationError extends Error {
	readonly category: WorkerErrorCategory;

	constructor(category: WorkerErrorCategory, message: string) {
		super(message);
		this.category = category;
		this.name = 'ProviderAutomationError';
	}
}

export interface EcardProviderClient {
	lookupStudentByNameEmail(input: LookupProviderInput): Promise<LookupProviderResult>;
	verifyEmployerBatch(entries: VerifyBatchInput[]): Promise<VerifyBatchResult[]>;
}

class NoopEcardProviderClient implements EcardProviderClient {
	async lookupStudentByNameEmail(input: LookupProviderInput): Promise<LookupProviderResult> {
		const email = input.email.toLowerCase();
		if (email.includes('captcha')) {
			throw new ProviderAutomationError('captcha_detected', 'CAPTCHA detected in noop provider');
		}
		if (email.includes('nocerts')) {
			return { certs: [] };
		}

		const seed = `${input.firstName}${input.lastName}${input.email}`;
		const certs: LookupProviderResult['certs'] = FIXED_CERTIFICATION_CODES.map((certCode) => ({
			certCode,
			providerCertLabel: certCode,
			ecardCode: makeDeterministicCode(seed, certCode)
		}));

		if (email.includes('unknown')) {
			certs.push({
				certCode: null,
				providerCertLabel: 'NRP',
				ecardCode: makeDeterministicCode(seed, 'BLS').replace('BLS', 'NRP')
			});
		}

		return { certs };
	}

	async verifyEmployerBatch(entries: VerifyBatchInput[]): Promise<VerifyBatchResult[]> {
		return entries.map((entry) => {
			const code = entry.ecardCode.toLowerCase();
			if (code.includes('captcha')) {
				return {
					jobId: entry.jobId,
					ecardEntryId: entry.ecardEntryId,
					status: 'failed',
					errorMessage: 'CAPTCHA detected in noop provider',
					errorCategory: 'captcha_detected'
				};
			}
			if (code.includes('fail')) {
				return {
					jobId: entry.jobId,
					ecardEntryId: entry.ecardEntryId,
					status: 'failed',
					errorMessage: 'Noop provider forced failure',
					errorCategory: 'provider_error'
				};
			}
			return {
				jobId: entry.jobId,
				ecardEntryId: entry.ecardEntryId,
				status: 'verified'
			};
		});
	}
}

async function clickFirstMatch(
	page: import('playwright').Page,
	selectors: string[]
): Promise<boolean> {
	for (const selector of selectors) {
		const locator = page.locator(selector).first();
		if ((await locator.count()) === 0) {
			continue;
		}
		if (!(await locator.isVisible().catch(() => false))) {
			continue;
		}
		await locator.click();
		return true;
	}
	return false;
}

async function fillFirstMatch(
	page: import('playwright').Page,
	selectors: string[],
	value: string
): Promise<boolean> {
	for (const selector of selectors) {
		const locator = page.locator(selector).first();
		if ((await locator.count()) === 0) {
			continue;
		}
		if (!(await locator.isVisible().catch(() => false))) {
			continue;
		}
		await locator.fill(value);
		return true;
	}
	return false;
}

async function detectCaptcha(page: import('playwright').Page): Promise<boolean> {
	for (const selector of HEART_SELECTORS.captchaSignals) {
		const locator = page.locator(selector).first();
		if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
			return true;
		}
	}
	return false;
}

class LiveHeartProviderClient implements EcardProviderClient {
	private readonly env = getServerEnv();

	private async withPage<T>(callback: (page: import('playwright').Page) => Promise<T>): Promise<T> {
		const playwright = await import('playwright');
		const browser = await playwright.chromium.launch({ headless: this.env.WORKER_HEADLESS });
		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			await page.goto(this.env.HEART_PROVIDER_BASE_URL, { waitUntil: 'domcontentloaded' });
			return await callback(page);
		} finally {
			await context.close();
			await browser.close();
		}
	}

	private async login(page: import('playwright').Page): Promise<void> {
		if (!this.env.HEART_PROVIDER_EMAIL || !this.env.HEART_PROVIDER_PASSWORD) {
			throw new ProviderAutomationError(
				'validation_error',
				'Missing HEART_PROVIDER_EMAIL/HEART_PROVIDER_PASSWORD for live provider mode'
			);
		}

		const filledEmail = await fillFirstMatch(
			page,
			HEART_SELECTORS.loginEmail,
			this.env.HEART_PROVIDER_EMAIL
		);
		const filledPassword = await fillFirstMatch(
			page,
			HEART_SELECTORS.loginPassword,
			this.env.HEART_PROVIDER_PASSWORD
		);
		if (!filledEmail || !filledPassword) {
			throw new ProviderAutomationError(
				'validation_error',
				'Unable to locate login inputs on provider page'
			);
		}

		const clicked = await clickFirstMatch(page, HEART_SELECTORS.loginSubmit);
		if (!clicked) {
			throw new ProviderAutomationError(
				'validation_error',
				'Unable to locate provider login submit button'
			);
		}

		await page.waitForLoadState('networkidle', { timeout: 20_000 });
		if (await detectCaptcha(page)) {
			throw new ProviderAutomationError(
				'captcha_detected',
				'CAPTCHA challenge detected during provider login'
			);
		}
	}

	async lookupStudentByNameEmail(input: LookupProviderInput): Promise<LookupProviderResult> {
		try {
			return await this.withPage(async (page) => {
				await this.login(page);

				const hasFirstName = await fillFirstMatch(
					page,
					HEART_SELECTORS.lookupFirstName,
					input.firstName
				);
				const hasLastName = await fillFirstMatch(
					page,
					HEART_SELECTORS.lookupLastName,
					input.lastName
				);
				const hasEmail = await fillFirstMatch(page, HEART_SELECTORS.lookupEmail, input.email);
				if (!hasFirstName || !hasLastName || !hasEmail) {
					throw new ProviderAutomationError(
						'validation_error',
						'Unable to locate lookup form fields for first/last/email'
					);
				}

				const clicked = await clickFirstMatch(page, HEART_SELECTORS.lookupSubmit);
				if (!clicked) {
					throw new ProviderAutomationError(
						'validation_error',
						'Unable to locate lookup submit button'
					);
				}

				await page.waitForLoadState('networkidle', { timeout: 20_000 });
				if (await detectCaptcha(page)) {
					throw new ProviderAutomationError(
						'captcha_detected',
						'CAPTCHA challenge detected during lookup'
					);
				}

				const rows = page.locator(HEART_SELECTORS.resultsRow.join(', '));
				const rowCount = await rows.count();
				const certs: LookupProviderResult['certs'] = [];

				for (let index = 0; index < rowCount; index += 1) {
					const row = rows.nth(index);
					const labelText = await row
						.locator(HEART_SELECTORS.resultCertLabel.join(', '))
						.first()
						.innerText()
						.catch(() => '');
					const codeText = await row
						.locator(HEART_SELECTORS.resultCode.join(', '))
						.first()
						.innerText()
						.catch(() => '');

					const ecardCode = codeText.trim();
					if (!ecardCode) {
						continue;
					}

					certs.push({
						ecardCode,
						providerCertLabel: labelText.trim() || 'UNKNOWN',
						certCode: labelText.trim() || null
					});
				}

				return { certs };
			});
		} catch (error) {
			if (error instanceof ProviderAutomationError) {
				throw error;
			}
			throw new ProviderAutomationError(
				classifyProviderError(error),
				`Provider lookup failed: ${String(error)}`
			);
		}
	}

	async verifyEmployerBatch(entries: VerifyBatchInput[]): Promise<VerifyBatchResult[]> {
		if (entries.length === 0) {
			return [];
		}

		try {
			return await this.withPage(async (page) => {
				await this.login(page);
				const clickedEmployer = await clickFirstMatch(page, HEART_SELECTORS.employerToggle);
				if (!clickedEmployer) {
					throw new ProviderAutomationError(
						'validation_error',
						'Unable to locate employer verification route'
					);
				}

				const codes = entries.map((entry) => entry.ecardCode).join('\n');
				const filled = await fillFirstMatch(page, HEART_SELECTORS.employerCodesInput, codes);
				if (!filled) {
					throw new ProviderAutomationError(
						'validation_error',
						'Unable to locate employer eCard input'
					);
				}

				const clickedSubmit = await clickFirstMatch(page, HEART_SELECTORS.employerSubmit);
				if (!clickedSubmit) {
					throw new ProviderAutomationError(
						'validation_error',
						'Unable to locate employer verify submit'
					);
				}

				await page.waitForLoadState('networkidle', { timeout: 20_000 });
				if (await detectCaptcha(page)) {
					throw new ProviderAutomationError(
						'captcha_detected',
						'CAPTCHA challenge detected during employer verification'
					);
				}

				return entries.map((entry) => ({
					jobId: entry.jobId,
					ecardEntryId: entry.ecardEntryId,
					status: 'verified' as const
				}));
			});
		} catch (error) {
			if (error instanceof ProviderAutomationError) {
				return entries.map((entry) => ({
					jobId: entry.jobId,
					ecardEntryId: entry.ecardEntryId,
					status: 'failed' as const,
					errorMessage: error.message,
					errorCategory: error.category
				}));
			}

			const category = classifyProviderError(error);
			return entries.map((entry) => ({
				jobId: entry.jobId,
				ecardEntryId: entry.ecardEntryId,
				status: 'failed' as const,
				errorMessage: `Provider verification failed: ${String(error)}`,
				errorCategory: category
			}));
		}
	}
}

function createClientFromEnv(): EcardProviderClient {
	const env = getServerEnv();
	if (env.HEART_PROVIDER_MODE === 'live') {
		return new LiveHeartProviderClient();
	}
	return new NoopEcardProviderClient();
}

export const ecardProviderClient: EcardProviderClient = createClientFromEnv();
