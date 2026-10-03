#!/bin/sh
# Container entrypoint for the ResQ-Go API.
#
# The schema is synchronised before the server accepts traffic so a freshly
# provisioned environment comes up usable. Demo data is deliberately NOT seeded
# here: seeded accounts ship with published passwords, which has no place in a
# deployed environment. Load them locally with `npm run db:seed`.
set -e

echo "resq-go-api: synchronising database schema"
npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate

echo "resq-go-api: starting server"
exec node apps/api/dist/main.js