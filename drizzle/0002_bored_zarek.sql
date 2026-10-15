CREATE TYPE "public"."verification_job_type" AS ENUM('verify_ecard', 'lookup_name_email');--> statement-breakpoint
ALTER TABLE "verification_jobs" ALTER COLUMN "ecard_entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ecard_entries" ADD COLUMN "provider_cert_label" text;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "job_type" "verification_job_type";--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "error_category" text;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "claimed_by" text;--> statement-breakpoint
UPDATE "verification_jobs" AS v
SET
	"job_type" = 'verify_ecard',
	"submission_id" = e."submission_id"
FROM "ecard_entries" AS e
WHERE
	v."ecard_entry_id" = e."id"
	AND (v."job_type" IS NULL OR v."submission_id" IS NULL);--> statement-breakpoint
ALTER TABLE "verification_jobs" ALTER COLUMN "job_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_jobs" ALTER COLUMN "submission_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD CONSTRAINT "verification_jobs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_jobs_status_queued_idx" ON "verification_jobs" USING btree ("status","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_jobs_verify_active_unique" ON "verification_jobs" USING btree ("ecard_entry_id") WHERE "verification_jobs"."job_type" = 'verify_ecard' and "verification_jobs"."status" in ('pending', 'processing') and "verification_jobs"."ecard_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_jobs_lookup_active_unique" ON "verification_jobs" USING btree ("submission_id") WHERE "verification_jobs"."job_type" = 'lookup_name_email' and "verification_jobs"."status" in ('pending', 'processing');
