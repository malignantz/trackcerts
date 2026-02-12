interface PostgresErrorLike {
	code?: string;
	constraint?: string;
}

function asPostgresError(error: unknown): PostgresErrorLike | null {
	if (!error || typeof error !== 'object') {
		return null;
	}

	const candidate = error as PostgresErrorLike;
	if (typeof candidate.code !== 'string') {
		return null;
	}

	return candidate;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
	const postgresError = asPostgresError(error);
	if (!postgresError || postgresError.code !== '23505') {
		return false;
	}

	if (!constraint) {
		return true;
	}

	return postgresError.constraint === constraint;
}
