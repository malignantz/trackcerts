import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool } from 'pg';

function loadLocalEnv() {
	const envPath = resolve(process.cwd(), '.env');
	if (!existsSync(envPath)) {
		return;
	}

	const content = readFileSync(envPath, 'utf8');
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');
		if (separator < 1) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function toKey(firstName, lastName) {
	return `${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
}

loadLocalEnv();

const DATABASE_URL = requireEnv('DATABASE_URL');

const SEED_ORGANIZATION_NAME = process.env.SEED_ORGANIZATION_NAME ?? 'Mercy General Hospital';
const SEED_ORGANIZATION_SLUG = process.env.SEED_ORGANIZATION_SLUG ?? 'mercy-general';
const SEED_SITE_CODE =
	process.env.SEED_SITE_CODE ??
	SEED_ORGANIZATION_SLUG.replace(/[^a-z0-9]/gi, '')
		.slice(0, 8)
		.toLowerCase();
const SEED_OWNER_USER_ID = process.env.SEED_OWNER_USER_ID;
const SEED_OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@mercy-general.test';

const seedCertificationTypes = [
	{ code: 'BLS', label: 'Basic Life Support' },
	{ code: 'ACLS', label: 'Advanced Cardiac Life Support' },
	{ code: 'PALS', label: 'Pediatric Advanced Life Support' }
];

const seedStaff = [
	{ firstName: 'Emma', lastName: 'Reed' },
	{ firstName: 'Noah', lastName: 'Kim' },
	{ firstName: 'Olivia', lastName: 'Patel' },
	{ firstName: 'Liam', lastName: 'Brooks' },
	{ firstName: 'Ava', lastName: 'Nguyen' }
];

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const orgResult = await client.query(
			`INSERT INTO organizations (name, slug, site_code, staff_onboarding_complete)
			 VALUES ($1, $2, $3, TRUE)
			 ON CONFLICT (slug)
			 DO UPDATE SET
				name = EXCLUDED.name,
				site_code = EXCLUDED.site_code,
				staff_onboarding_complete = TRUE,
				updated_at = NOW()
			 RETURNING id`,
			[SEED_ORGANIZATION_NAME, SEED_ORGANIZATION_SLUG, SEED_SITE_CODE]
		);
		const organizationId = orgResult.rows[0].id;

		if (SEED_OWNER_USER_ID) {
			await client.query(
				`INSERT INTO user_profiles (id, email)
				 VALUES ($1, $2)
				 ON CONFLICT (id)
				 DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
				[SEED_OWNER_USER_ID, SEED_OWNER_EMAIL]
			);

			await client.query(
				`INSERT INTO organization_memberships (organization_id, user_id, role, is_active)
				 VALUES ($1, $2, 'owner', TRUE)
				 ON CONFLICT (organization_id, user_id)
				 DO UPDATE SET role = 'owner', is_active = TRUE, updated_at = NOW()`,
				[organizationId, SEED_OWNER_USER_ID]
			);
		}

		let certificationUpserts = 0;
		for (const cert of seedCertificationTypes) {
			await client.query(
				`INSERT INTO certification_types (organization_id, code, label, is_active)
				 VALUES ($1, $2, $3, TRUE)
				 ON CONFLICT (organization_id, code)
				 DO UPDATE SET label = EXCLUDED.label, is_active = TRUE, updated_at = NOW()`,
				[organizationId, cert.code, cert.label]
			);
			certificationUpserts += 1;
		}

		const existingStaffRows = await client.query(
			'SELECT first_name, last_name FROM staff WHERE organization_id = $1',
			[organizationId]
		);

		const existingStaffKeys = new Set(
			existingStaffRows.rows.map((row) => toKey(row.first_name, row.last_name))
		);

		let insertedStaff = 0;
		for (const person of seedStaff) {
			if (existingStaffKeys.has(toKey(person.firstName, person.lastName))) {
				continue;
			}

			await client.query(
				`INSERT INTO staff (organization_id, first_name, last_name, is_active)
				 VALUES ($1, $2, $3, TRUE)`,
				[organizationId, person.firstName, person.lastName]
			);
			insertedStaff += 1;
		}

		await client.query('COMMIT');

		console.log('Seed complete');
		console.log(`- organization: ${SEED_ORGANIZATION_NAME} (${SEED_ORGANIZATION_SLUG})`);
		console.log(`- site code: ${SEED_SITE_CODE}`);
		console.log(`- certification types upserted: ${certificationUpserts}`);
		console.log(`- staff inserted: ${insertedStaff}`);
		if (SEED_OWNER_USER_ID) {
			console.log(`- owner membership ensured for user: ${SEED_OWNER_USER_ID}`);
		} else {
			console.log('- owner membership skipped (set SEED_OWNER_USER_ID to enable)');
		}
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

seed()
	.catch((error) => {
		console.error('Seed failed:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await pool.end();
	});
