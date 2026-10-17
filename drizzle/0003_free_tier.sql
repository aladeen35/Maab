CREATE TYPE "public"."certificate_kind" AS ENUM('juz', 'khatm', 'course');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial" text NOT NULL,
	"code" text NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid,
	"kind" "certificate_kind" NOT NULL,
	"juz" smallint,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"student_name" text NOT NULL,
	"teacher_name" text,
	"mastery" numeric(5, 2),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	CONSTRAINT "certificates_serial_unique" UNIQUE("serial"),
	CONSTRAINT "certificates_code_unique" UNIQUE("code"),
	CONSTRAINT "certificates_juz_ck" CHECK (("certificates"."kind" = 'juz') = ("certificates"."juz" is not null) and ("certificates"."juz" is null or "certificates"."juz" between 1 and 30))
);
--> statement-breakpoint
CREATE TABLE "file_blobs" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"name" text NOT NULL,
	"slot" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"result" jsonb,
	"error" text,
	CONSTRAINT "job_runs_name_slot_pk" PRIMARY KEY("name","slot")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failures" smallint DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_blobs" ADD CONSTRAINT "file_blobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_student_idx" ON "certificates" USING btree ("student_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_auto_uq" ON "certificates" USING btree ("student_id","kind",coalesce("juz", 0)) WHERE "certificates"."kind" in ('juz', 'khatm') and "certificates"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "job_runs_started_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
-- الرقم التسلسلي للشهادات (MAAB-C-2026-00001)
CREATE SEQUENCE IF NOT EXISTS "certificate_serial_seq";--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE "certificate_serial_seq" TO service_role;--> statement-breakpoint
-- الشهادة يراها من يرى الطالب، وإصدارها وإلغاؤها في الخادم وحده (service_role)
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY certificates_select ON public.certificates FOR SELECT TO authenticated USING (app.can_read_student(student_id));--> statement-breakpoint
GRANT SELECT ON "certificates" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "certificates" TO service_role;--> statement-breakpoint
-- اشتراكات الإشعارات: كل مستخدم يدير اشتراكات أجهزته فقط
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "push_subscriptions" TO authenticated, service_role;--> statement-breakpoint
-- جداول للنظام وحده: بلا سياسات، فلا يصل إليها دور authenticated أو anon
ALTER TABLE "job_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "file_blobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "job_runs", "integrations", "file_blobs" TO service_role;
