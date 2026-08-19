CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text,
	"handle" text,
	"unit_pence" integer,
	"currency" char(3) DEFAULT 'GBP' NOT NULL,
	"week_start" smallint DEFAULT 1 NOT NULL,
	"odds_format" text DEFAULT 'decimal' NOT NULL,
	"show_profit_in" text DEFAULT 'currency' NOT NULL,
	"calendar_dates" boolean DEFAULT true NOT NULL,
	"theme" text DEFAULT 'periwinkle' NOT NULL,
	"bankroll_start_pence" integer,
	"link_code" text,
	"link_code_expires_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"trial_slips_allowed" integer,
	"trial_slips_used" integer DEFAULT 0 NOT NULL,
	"plan" text,
	"plan_state" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"payment_failures" integer DEFAULT 0 NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"referred_by" uuid,
	"target_pence" integer,
	"card_order" jsonb,
	"cards_above" jsonb,
	"is_tester" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"source" text,
	"after_result_known" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"selection" text,
	"market_raw" text,
	"market_group_id" uuid,
	"fixture_id" uuid,
	"event_name" text,
	"leg_odds" numeric(10, 3),
	"leg_result" text
);
--> statement-breakpoint
CREATE TABLE "bet_state" (
	"bet_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"remaining_stake_pence" integer NOT NULL,
	"realised_pl_pence" integer NOT NULL,
	"returned_pence" integer NOT NULL,
	"units" numeric(10, 2),
	"voided_stake_pence" integer DEFAULT 0 NOT NULL,
	"counts_in_stats" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_tags" (
	"bet_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "bet_tags_bet_id_tag_id_pk" PRIMARY KEY("bet_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"shape" text DEFAULT 'single' NOT NULL,
	"side" text DEFAULT 'back' NOT NULL,
	"stake_pence" integer NOT NULL,
	"liability_pence" integer,
	"odds" numeric(10, 3),
	"currency" char(3) DEFAULT 'GBP' NOT NULL,
	"fx_rate" numeric(12, 6),
	"bookmaker_id" uuid,
	"tipster_id" uuid,
	"sport_id" uuid,
	"competition" text,
	"course" text,
	"event_name" text,
	"selection" text,
	"market_raw" text,
	"market_group_id" uuid,
	"event_at" timestamp with time zone NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"expected_settle_at" timestamp with time zone,
	"is_free_bet" boolean DEFAULT false NOT NULL,
	"is_each_way" boolean DEFAULT false NOT NULL,
	"ew_place_fraction" text,
	"rule4_deduction" numeric(5, 2),
	"is_antepost" boolean DEFAULT false NOT NULL,
	"slip_backed" boolean DEFAULT false NOT NULL,
	"source" text,
	"arb_group_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"name" text NOT NULL,
	"group_name" text,
	"commission_pct" numeric(5, 2),
	"handicap_style" text DEFAULT 'european' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_account_id_pk" PRIMARY KEY("group_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"picture_url" text,
	"join_mode" text DEFAULT 'open' NOT NULL,
	"ranking_period" text DEFAULT 'M' NOT NULL,
	"slip_backed_only" boolean DEFAULT false NOT NULL,
	"show_edit_audit" boolean DEFAULT false NOT NULL,
	"invite_code" text,
	"admin_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_group_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"canonical_name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"chat_id" bigint,
	"message_id" integer,
	"payload" jsonb NOT NULL,
	"confirmed_bet_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"promo_code" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pl_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"amount_pence" integer NOT NULL,
	"stake_pence" integer,
	"bookmaker_id" uuid,
	"note" text,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_key" text NOT NULL,
	"bookmaker" text,
	"expected" jsonb NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"fraction_eighths" smallint,
	"stake_portion_pence" integer,
	"odds" numeric(10, 3),
	"returned_pence" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entered_by" text,
	"after_result_known" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slip_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"bet_id" uuid,
	"storage_key" text,
	"sha256" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delete_after" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"telegram_user_id" bigint PRIMARY KEY NOT NULL,
	"chat_id" bigint,
	"account_id" uuid NOT NULL,
	"telegram_username" text,
	"dormant" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipsters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit_pence_override" integer,
	"channel_ref" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"is_bot_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_market_group_id_market_groups_id_fk" FOREIGN KEY ("market_group_id") REFERENCES "public"."market_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_state" ADD CONSTRAINT "bet_state_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_tags" ADD CONSTRAINT "bet_tags_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_tags" ADD CONSTRAINT "bet_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_bookmaker_id_bookmakers_id_fk" FOREIGN KEY ("bookmaker_id") REFERENCES "public"."bookmakers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_tipster_id_tipsters_id_fk" FOREIGN KEY ("tipster_id") REFERENCES "public"."tipsters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_group_id_market_groups_id_fk" FOREIGN KEY ("market_group_id") REFERENCES "public"."market_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmakers" ADD CONSTRAINT "bookmakers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_accounts_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_accounts_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_admin_account_id_accounts_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_aliases" ADD CONSTRAINT "market_aliases_market_group_id_market_groups_id_fk" FOREIGN KEY ("market_group_id") REFERENCES "public"."market_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_groups" ADD CONSTRAINT "market_groups_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_reads" ADD CONSTRAINT "pending_reads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_entries" ADD CONSTRAINT "pl_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_entries" ADD CONSTRAINT "pl_entries_bookmaker_id_bookmakers_id_fk" FOREIGN KEY ("bookmaker_id") REFERENCES "public"."bookmakers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_events" ADD CONSTRAINT "settlement_events_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_images" ADD CONSTRAINT "slip_images_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_images" ADD CONSTRAINT "slip_images_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports" ADD CONSTRAINT "sports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipsters" ADD CONSTRAINT "tipsters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_handle_key" ON "accounts" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_link_code_key" ON "accounts" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bet_legs_seq_key" ON "bet_legs" USING btree ("bet_id","seq");--> statement-breakpoint
CREATE INDEX "bets_account_event_idx" ON "bets" USING btree ("account_id","event_at");--> statement-breakpoint
CREATE INDEX "bets_arb_idx" ON "bets" USING btree ("arb_group_id");--> statement-breakpoint
CREATE INDEX "bookmakers_account_idx" ON "bookmakers" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_invite_code_key" ON "groups" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_signups_email_key" ON "pending_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pl_entries_account_date_idx" ON "pl_entries" USING btree ("account_id","entry_date");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_events_seq_key" ON "settlement_events" USING btree ("bet_id","seq");--> statement-breakpoint
CREATE INDEX "slip_images_sha_idx" ON "slip_images" USING btree ("account_id","sha256");--> statement-breakpoint
CREATE INDEX "telegram_links_account_idx" ON "telegram_links" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tipsters_account_idx" ON "tipsters" USING btree ("account_id");