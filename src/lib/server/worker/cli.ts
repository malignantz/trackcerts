import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv(): void {
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

async function main(): Promise<void> {
	loadLocalEnv();
	const { runWorkerLoop, runWorkerOnce } = await import('./runner');
	const command = process.argv[2] ?? 'once';

	if (command === 'once') {
		const stats = await runWorkerOnce();
		console.warn(
			JSON.stringify({
				event: 'worker_once_stats',
				...stats
			})
		);
		return;
	}

	if (command === 'run') {
		await runWorkerLoop();
		return;
	}

	throw new Error(`Unknown worker command: ${command}. Expected "once" or "run".`);
}

main().catch((error) => {
	console.error('Worker command failed', error);
	process.exitCode = 1;
});
