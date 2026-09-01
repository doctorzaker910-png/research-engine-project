# RAE Research Engine

RAE is a competency-gated research learning platform for students and human supervisors.

## Educational authority

- AI provides coaching and an advisory readiness report.
- AI cannot approve competency or unlock progression.
- Only the assigned authenticated human supervisor can approve a stage.
- Progression is competency-gated, not time-based.

## Production workflow

1. A student creates an account and signs in.
2. The student creates a research pathway with a separate name and research topic.
3. The student completes the current stage: initial attempt, AI coaching record, reflection, final submission, and evidence log.
4. The submission and advisory AI report become visible to the assigned supervisor on another device.
5. The supervisor either returns the work with revision guidance or checks every competency indicator and approves it.
6. The next stage opens only after the human approval is stored in the database.

## Security and persistence

- Supabase Auth provides separate student and supervisor sessions.
- Postgres with Row Level Security isolates each case to its student and assigned supervisor.
- Student work and supervisor reviews are stored separately.
- Students cannot write supervisor decisions or reassign their supervisor.
- The AI endpoint requires a valid session, verifies case access, validates payload size, applies rate limits, and uses security headers.
- Audit events record submission and review actions.

## Privacy rule

Do not enter patient names, medical record numbers, phone numbers, or confidential clinical data. Student work is sent to the configured AI provider only to produce advisory educational analysis.

## Local verification

```bash
npm ci
npm test
npm run build
npm run lint
npm audit --omit=dev
```

The deployed service exposes `GET /healthz` for availability checks.
