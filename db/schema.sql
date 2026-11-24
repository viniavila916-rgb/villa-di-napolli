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

-- Corretor que indicou o cliente (vem do link ?corretor=nome).
alter table bookings add column if not exists broker text;

create index if not exists bookings_slot_idx on bookings (slot_id);

-- Um mesmo WhatsApp só pode ter UMA reserva confirmada ao mesmo tempo.
create unique index if not exists bookings_one_confirmed_per_whatsapp
  on bookings (whatsapp) where status = 'confirmed';

-- ---------- Corretores (agenda por corretor) ----------
-- Com pelo menos um corretor ATIVO cadastrado, a agenda passa a ser
-- por corretor: cada corretor tem o próprio link e atende 1 cliente
-- por horário. Não há distribuição automática entre corretores. Sem
-- corretores cadastrados, vale a capacidade definida em cada horário.
create table if not exists brokers (
  slug       text primary key,
  name       text        not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

-- Horário em que um corretor específico não atende (almoço, ausência).
create table if not exists broker_slot_blocks (
  slot_id     uuid not null references event_slots (id) on delete cascade,
  broker_slug text not null references brokers (slug) on delete cascade,
  primary key (slot_id, broker_slug)
);

-- 'link'  = o cliente veio pelo link do corretor;
-- 'geral' = veio pelo link sem corretor e caiu no "corretor do link geral".
alter table bookings add column if not exists broker_source text;

-- ---------- Regra central: vagas, bloqueio e horário passado ----------
-- Roda dentro do próprio INSERT/UPDATE. Trava a linha do horário
-- (FOR UPDATE), então duas reservas simultâneas são processadas uma
-- de cada vez: a segunda já enxerga a primeira e é recusada.
create or replace function enforce_slot_rules() returns trigger
language plpgsql as $$
declare
  s         event_slots%rowtype;
  taken     integer;
  n_brokers integer;
  chosen    text;
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

  select count(*) into n_brokers from brokers where active;

  if n_brokers > 0 then
    -- ===== Agenda por corretor =====
    if new.broker is not null
       and exists (select 1 from brokers where slug = new.broker and active) then
      -- Veio pelo link de um corretor: só serve a vaga DELE.
      if exists (select 1 from broker_slot_blocks
                  where slot_id = new.slot_id and broker_slug = new.broker)
         or exists (select 1 from bookings
                     where slot_id = new.slot_id and broker = new.broker
                       and status <> 'cancelled' and id <> new.id) then
        raise exception 'Corretor ocupado neste horario' using errcode = 'VN001';
      end if;
      new.broker_source := coalesce(new.broker_source, 'link');
    else
      -- Veio sem link de corretor (ou com link desconhecido). Não há
      -- distribuição: só é aceito se o painel tiver definido um
      -- "corretor do link geral"; aí vale a agenda desse corretor.
      select value into chosen from settings where key = 'default_broker';
      if chosen is null or chosen = ''
         or not exists (select 1 from brokers where slug = chosen and active) then
        raise exception 'Agendamento exige link de corretor' using errcode = 'VN005';
      end if;
      if exists (select 1 from broker_slot_blocks
                  where slot_id = new.slot_id and broker_slug = chosen)
         or exists (select 1 from bookings
                     where slot_id = new.slot_id and broker = chosen
                       and status <> 'cancelled' and id <> new.id) then
        raise exception 'Corretor ocupado neste horario' using errcode = 'VN001';
      end if;
      new.broker := chosen;
      new.broker_source := 'geral';
    end if;
  else
    -- ===== Agenda única (sem corretores cadastrados) =====
    select count(*) into taken
      from bookings
     where slot_id = new.slot_id
       and status <> 'cancelled'
       and id <> new.id;
    if taken >= s.capacity then
      raise exception 'Horario esgotado' using errcode = 'VN001';
    end if;
    if new.broker is not null then
      new.broker_source := coalesce(new.broker_source, 'link');
    end if;
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
alter table brokers            enable row level security;
alter table broker_slot_blocks enable row level security;
