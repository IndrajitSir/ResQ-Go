/**
 * Jest global setup.
 *
 * The suites boot the real Nest module graph, which reads configuration at
 * import time. Relying on the developer's ambient shell environment made the
 * end-to-end suite fail to even load (`Missing required environment variable:
 * JWT_SECRET`) on any machine that had not exported the variables by hand.
 *
 * These values are TEST-ONLY defaults: a fixed secret for signature
 * verification and a local database URL that Compose provides. Anything already
 * present in the environment always wins, so CI and container runs can point
 * the suites at a different database without editing this file.
 *
 * The secret below is intentionally public: it never signs a real token.
 */
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-outside-tests';
process.env.JWT_EXPIRES_IN ??= '12h';
process.env.NODE_ENV ??= 'test';

// Keep the API honest about the database during tests: never let a suite
// silently fall back to a different driver or an in-memory substitute.
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ?? 'postgresql://abs:abs_dev_password@localhost:5432/abs';

export {};