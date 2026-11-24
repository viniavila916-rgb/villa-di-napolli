-- =====================================================================
-- Black November Villa di Napoli — estrutura do banco (PostgreSQL)
-- Pode ser executado mais de uma vez sem apagar dados.
-- Funciona no Supabase (SQL Editor) e em qualquer PostgreSQL 13+.
-- =====================================================================

-- ---------- Horários do plantão ----------
create table if not exists event_slots (
  id          uuid primary key default gen_random_uuid(),
  slot_date   date        not null,
  start_time  time        not null,
  end_time    time        not null,
  status      text        not null default 'open'
              check (status in ('open', 'blocked')),
  capacity    integer     not null default 1 check (capacity >= 1),
  created_at  timestamptz not null default now(),
  constraint event_slots_unique_start unique (slot_date, start_time),
  constraint event_slots_time_order check (end_time > start_time)
);

-- ---------- Agendamentos ----------
create table if not exists bookings (
  id                 uuid primary key default gen_random_uuid(),
  public_token       uuid        not null unique default gen_random_uuid(),
  code               text        not null unique,
  slot_id            uuid        not null references event_slots (id) on delete restrict,
  slot_date          date        not null,
  start_time         time        not null,
  end_time           time        not null,
  name               text        not null,
  whatsapp           text        not null,
  email              text,
  income_range       text,
  status             text        not null default 'confirmed'
                     check (status in ('confirmed', 'attended', 'no_show', 'cancelled')),
  privacy_consent_at timestamptz not null,
  marketing_opt_in   boolean     not null default false,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists bookings_slot_idx on bookings (slot_id);

-- Um mesmo WhatsApp só pode ter UMA reserva confirmada ao mesmo tempo.
create unique index if not exists bookings_one_confirmed_per_whatsapp
  on bookings (whatsapp) where status = 'confirmed';

-- ---------- Regra central: capacidade, bloqueio e horário passado ----------
-- Roda dentro do próprio INSERT/UPDATE. Trava a linha do horário
-- (FOR UPDATE), então duas reservas simultâneas são processadas uma
-- de cada vez: a segunda já enxerga a primeira e é recusada.
create or replace function enforce_slot_rules() returns trigger
language plpgsql as $$
declare
  s     event_slots%rowtype;
  taken integer;
begin
  if new.status = 'cancelled' then
    new.updated_at := now();
    return new;
  end if;

  -- Atualização que não muda de horário nem "reativa" um cancelamento
  if tg_op = 'UPDATE' then
    if old.slot_id = new.slot_id and old.status <> 'cancelled' then
      new.updated_at := now();
      return new;
    end if;
  end if;

  select * into s from event_slots where id = new.slot_id for update;
  if not found then
    raise exception 'Horario inexistente' using errcode = 'VN404';
  end if;
  if s.status <> 'open' then
    raise exception 'Horario bloqueado' using errcode = 'VN002';
  end if;
  if ((s.slot_date + s.start_time) at time zone 'America/Sao_Paulo') <= now() then
    raise exception 'Horario ja passou' using errcode = 'VN003';
  end if;

  select count(*) into taken
    from bookings
   where slot_id = new.slot_id
     and status <> 'cancelled'
     and id <> new.id;

  if taken >= s.capacity then
    raise exception 'Horario esgotado' using errcode = 'VN001';
  end if;

  new.slot_date  := s.slot_date;
  new.start_time := s.start_time;
  new.end_time   := s.end_time;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_enforce_slot_rules on bookings;
create trigger bookings_enforce_slot_rules
  before insert or update on bookings
  for each row execute function enforce_slot_rules();

-- ---------- Unidades participantes da campanha (opcional) ----------
create table if not exists campaign_units (
  id          uuid primary key default gen_random_uuid(),
  label       text        not null unique,
  in_campaign boolean     not null default true,
  available   boolean     not null default true,
  updated_at  timestamptz not null default now()
);

-- ---------- Configurações editáveis pelo painel ----------
create table if not exists settings (
  key        text primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

-- ---------- Controle de abuso (não guarda IP, só um código embaralhado) ----------
create table if not exists request_log (
  id         bigserial primary key,
  bucket     text        not null,
  key_hash   text        not null,
  created_at timestamptz not null default now()
);
create index if not exists request_log_lookup on request_log (bucket, key_hash, created_at);

-- ---------- Segurança de acesso ----------
-- Com RLS ligado e nenhuma política criada, as chaves públicas do
-- Supabase (anon/authenticated) não conseguem ler nem gravar nada.
-- Só o servidor do site, que usa a conexão direta, acessa os dados.
alter table event_slots    enable row level security;
alter table bookings       enable row level security;
alter table campaign_units enable row level security;
alter table settings       enable row level security;
alter table request_log    enable row level security;
