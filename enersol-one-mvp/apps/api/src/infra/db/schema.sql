create table if not exists projects (
  id text primary key,
  project_number text not null unique,
  project_name text not null,
  client_name text not null,
  client_email text not null,
  engineer text not null,
  contractor text not null,
  sales_rep text not null,
  owner text not null,
  client_po text not null,
  carel_po text not null,
  status text not null,
  priority text not null,
  expected_delivery_date text,
  notes text,
  created_at text not null,
  updated_at text not null
);

create table if not exists project_documents (
  id text primary key,
  project_id text not null references projects(id),
  type text not null,
  filename text not null,
  source text not null,
  created_at text not null
);

create table if not exists alerts (
  id text primary key,
  project_id text not null references projects(id),
  level text not null,
  message text not null,
  created_at text not null
);

create table if not exists outlook_import_log (
  id text primary key,
  message_id text not null,
  extraction_status text not null,
  matched_project_id text,
  created_at text not null
);
