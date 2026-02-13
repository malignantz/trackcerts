CREATE TYPE "public"."certification_code" AS ENUM('ACLS', 'BLS', 'PALS');--> statement-breakpoint
CREATE TYPE "public"."intake_method" AS ENUM('ecard_direct', 'email_lookup');--> statement-breakpoint
CREATE TABLE "staff_certification_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"cert_code" "certification_code" NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_certification_requirements_staff_cert_unique" UNIQUE("staff_id","cert_code")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "site_code" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "staff_onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submitted_email" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "intake_method" "intake_method" NOT NULL DEFAULT 'ecard_direct';--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "source_site_code" text NOT NULL DEFAULT 'legacy';--> statement-breakpoint
ALTER TABLE "staff_certification_requirements" ADD CONSTRAINT "staff_certification_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_certification_requirements" ADD CONSTRAINT "staff_certification_requirements_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_certification_requirements_org_staff_idx" ON "staff_certification_requirements" USING btree ("organization_id","staff_id");--> statement-breakpoint
UPDATE "organizations"
SET "site_code" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE "site_code" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "site_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_site_code_unique" UNIQUE("site_code");
