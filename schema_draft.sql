-- Al-Israa QC Manager PostgreSQL schema draft
-- Review only. Not production-ready. No patient-result tables are included.
create extension if not exists pgcrypto;

create table devices (
 id uuid primary key default gen_random_uuid(),
 code text unique not null, name text not null, manufacturer text, model text,
 status text not null default 'active' check(status in ('active','planned','inactive')),
 created_at timestamptz not null default now()
);
create table analytes (
 id uuid primary key default gen_random_uuid(),
 code text unique not null, name text not null, unit text,
 created_at timestamptz not null default now()
);
create table device_analytes (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references devices(id),
 analyte_id uuid not null references analytes(id),
 method text, active boolean not null default true,
 unique(device_id,analyte_id)
);
create table qc_products (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references devices(id),
 manufacturer text not null, product_name text not null, matrix text,
 created_at timestamptz not null default now()
);
create table qc_lots (
 id uuid primary key default gen_random_uuid(),
 qc_product_id uuid not null references qc_products(id),
 lot_number text not null, expiry_date date, received_date date,
 status text not null default 'active' check(status in ('active','quarantined','expired','closed')),
 unique(qc_product_id,lot_number)
);
create table qc_levels (
 id uuid primary key default gen_random_uuid(),
 qc_product_id uuid not null references qc_products(id),
 level_code text not null, level_name text not null,
 unique(qc_product_id,level_code)
);
create table qc_targets (
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null references qc_lots(id),
 level_id uuid not null references qc_levels(id),
 analyte_id uuid not null references analytes(id),
 target_type text not null check(target_type in ('manufacturer','laboratory')),
 mean_value numeric not null, sd_value numeric not null check(sd_value>0),
 low_value numeric, high_value numeric, unit text not null,
 source_reference text not null, effective_from date, effective_to date,
 approved_by uuid, approved_at timestamptz,
 created_at timestamptz not null default now(),
 check(low_value is null or high_value is null or low_value<=high_value)
);
create table qc_rule_sets (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references devices(id),
 analyte_id uuid not null references analytes(id),
 name text not null, policy_reference text not null, version text not null,
 effective_from date not null, effective_to date, active boolean not null default false,
 approved_by uuid, approved_at timestamptz
);
create table qc_rule_configs (
 id uuid primary key default gen_random_uuid(),
 rule_set_id uuid not null references qc_rule_sets(id) on delete cascade,
 rule_code text not null check(rule_code in ('1_2S','1_3S','2_2S','R_4S','4_1S','10X')),
 enabled boolean not null default false, parameters jsonb not null default '{}'::jsonb,
 unique(rule_set_id,rule_code)
);
create table qc_runs (
 id uuid primary key default gen_random_uuid(),
 client_run_id uuid unique not null,
 device_id uuid not null references devices(id),
 lot_id uuid not null references qc_lots(id),
 run_at timestamptz not null, entered_by uuid,
 sync_state text not null default 'pending' check(sync_state in ('pending','synced','conflict')),
 notes text, created_at timestamptz not null default now()
);
create table qc_results (
 id uuid primary key default gen_random_uuid(),
 qc_run_id uuid not null references qc_runs(id),
 level_id uuid not null references qc_levels(id),
 analyte_id uuid not null references analytes(id),
 observed_value numeric not null, unit text not null,
 unique(qc_run_id,level_id,analyte_id)
);
create table qc_evaluations (
 id uuid primary key default gen_random_uuid(),
 qc_run_id uuid not null references qc_runs(id),
 rule_set_id uuid references qc_rule_sets(id),
 status text not null check(status in ('accepted','warning','rejected','pending_review')),
 engine_version text not null, snapshot jsonb not null,
 evaluated_at timestamptz not null default now(), evaluated_by uuid
);
create table qc_violations (
 id uuid primary key default gen_random_uuid(),
 evaluation_id uuid not null references qc_evaluations(id),
 rule_code text not null, analyte_id uuid references analytes(id),
 level_id uuid references qc_levels(id), description text not null,
 evidence jsonb not null default '{}'::jsonb
);
create table corrective_actions (
 id uuid primary key default gen_random_uuid(),
 evaluation_id uuid not null references qc_evaluations(id),
 cause text, action_taken text, verification_notes text,
 status text not null default 'open' check(status in ('open','in_progress','verified','closed')),
 opened_at timestamptz not null default now(), closed_at timestamptz
);
create table calibration_records (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references devices(id), analyte_id uuid references analytes(id),
 performed_at timestamptz not null, calibrator_lot text, result_summary jsonb not null default '{}'::jsonb,
 status text not null, notes text
);
create table eqa_records (
 id uuid primary key default gen_random_uuid(),
 provider text not null, scheme_name text, device_id uuid references devices(id),
 analyte_id uuid not null references analytes(id), sample_code text,
 submitted_at timestamptz, result_value numeric, assigned_value numeric,
 unit text, z_score numeric, report_reference text
);
create table aps_specs (
 id uuid primary key default gen_random_uuid(),
 analyte_id uuid not null references analytes(id), specification_name text not null,
 model_type text not null, allowable_error numeric not null, unit text not null,
 source_name text not null, source_version text, publication_year integer,
 effective_from date, effective_to date,
 approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected','retired')),
 approved_by uuid, approved_at timestamptz
);
create table scientific_sources (
 id uuid primary key default gen_random_uuid(),
 source_name text not null, source_url text not null unique,
 source_type text not null, access_method text not null default 'manual_review',
 active boolean not null default true, last_checked_at timestamptz
);
create table scientific_updates (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references scientific_sources(id),
 title text not null, update_url text, published_at date,
 detected_at timestamptz not null default now(), summary text, impact_assessment text,
 status text not null default 'pending_review' check(status in ('pending_review','approved','rejected','implemented')),
 reviewed_by uuid, reviewed_at timestamptz
);
create index idx_qc_runs_device_time on qc_runs(device_id,run_at desc);
create index idx_qc_results_analyte on qc_results(analyte_id,qc_run_id);
create index idx_qc_targets_lot_analyte on qc_targets(lot_id,analyte_id);
-- Before production: enable RLS, define organization/user authorization,
-- immutable audit trail, conflict-safe sync, retention, backup/restore and migrations.


-- Policy history: each device/analyte can have versioned, independently approved policies.
create table qc_policy_versions (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references devices(id),
 analyte_id uuid not null references analytes(id),
 policy_name text not null,
 policy_version text not null,
 policy_reference text not null,
 enabled_rules text[] not null default '{}',
 effective_from date not null,
 effective_to date,
 active boolean not null default false,
 approved_by uuid,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(device_id,analyte_id,policy_version)
);
create table audit_log (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid,
 action text not null,
 object_type text not null,
 object_id uuid,
 before_state jsonb,
 after_state jsonb,
 occurred_at timestamptz not null default now()
);
