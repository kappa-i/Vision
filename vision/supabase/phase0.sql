-- ============================================================
-- Vision — Phase 0 : RLS + RPC (audit 2026-06-12) — v2
-- À exécuter dans Supabase > SQL Editor. Idempotent (rejouable).
--
-- Modèle d'accès :
--   créatif = projects.owner_id ; client = ligne dans project_members.
--   Les vérifications owner/membre passent par des fonctions
--   SECURITY DEFINER : indispensables pour éviter la récursion infinie
--   entre les policies de projects et project_members.
--   Les écritures sensibles côté client passent par des RPC SECURITY DEFINER.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Colonne d'expiration des invitations (72 h par défaut)
-- ------------------------------------------------------------
alter table public.invites
  add column if not exists expires_at timestamptz default (now() + interval '72 hours');

-- ------------------------------------------------------------
-- 0bis. Rattrapage de schéma — colonnes présentes dans le SQLite
-- local mais potentiellement absentes du cloud (n'altère pas
-- les colonnes existantes). Symptôme corrigé : PGRST204
-- "Could not find the 'xxx' column ... in the schema cache".
-- ------------------------------------------------------------
alter table public.media
  add column if not exists before_path text,
  add column if not exists thumb_path text,
  add column if not exists title text,
  add column if not exists starred boolean default false,
  add column if not exists approval text,
  add column if not exists album text,
  add column if not exists in_delivery integer default 0,
  add column if not exists position integer;

alter table public.comments
  add column if not exists x double precision,
  add column if not exists y double precision,
  add column if not exists resolved boolean default false;

alter table public.projects
  add column if not exists description text,
  add column if not exists cover_path text;

alter table public.invites
  add column if not exists email text;

-- Force PostgREST à recharger son cache de schéma immédiatement
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 1. Helpers SECURITY DEFINER (bypass RLS → pas de récursion)
-- ------------------------------------------------------------
create or replace function public.is_project_owner(pid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from projects p
    where p.id::text = pid and p.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(pid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_members m
    where m.project_id::text = pid and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_project_owner(text) from public, anon;
revoke all on function public.is_project_member(text) from public, anon;
grant execute on function public.is_project_owner(text) to authenticated;
grant execute on function public.is_project_member(text) to authenticated;

-- ------------------------------------------------------------
-- 2. Activer RLS partout
-- ------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.media           enable row level security;
alter table public.comments        enable row level security;
alter table public.validations     enable row level security;
alter table public.invites         enable row level security;
alter table public.project_members enable row level security;
alter table public.stages          enable row level security;

-- ------------------------------------------------------------
-- 3. PROFILES — chacun gère le sien, lecture des noms ouverte
--    aux utilisateurs connectés (affichage des noms dans l'app)
-- ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (id = auth.uid());

-- ------------------------------------------------------------
-- 4. PROJECTS — visibles par owner + membres ; écrits par owner
--    (le client change le statut via la RPC set_project_status)
-- ------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (
    owner_id = auth.uid() or public.is_project_member(id::text)
  );

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (owner_id = auth.uid());

-- ------------------------------------------------------------
-- 5. MEDIA — lecture owner + membres ; écriture owner
--    (approbation/favori client via RPC dédiées)
-- ------------------------------------------------------------
drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to authenticated using (
    public.is_project_owner(project_id::text) or public.is_project_member(project_id::text)
  );

drop policy if exists media_write on public.media;
create policy media_write on public.media
  for all to authenticated
  using (public.is_project_owner(project_id::text))
  with check (public.is_project_owner(project_id::text));

-- ------------------------------------------------------------
-- 6. COMMENTS — owner + membres : lecture et écriture
-- ------------------------------------------------------------
drop policy if exists comments_rw on public.comments;
create policy comments_rw on public.comments
  for all to authenticated
  using (
    public.is_project_owner(project_id::text) or public.is_project_member(project_id::text)
  )
  with check (
    public.is_project_owner(project_id::text) or public.is_project_member(project_id::text)
  );

-- ------------------------------------------------------------
-- 7. VALIDATIONS — lecture owner + membres ; insertion membres
--    (valider est l'acte du client)
-- ------------------------------------------------------------
drop policy if exists validations_select on public.validations;
create policy validations_select on public.validations
  for select to authenticated using (
    public.is_project_owner(project_id::text) or public.is_project_member(project_id::text)
  );

drop policy if exists validations_insert on public.validations;
create policy validations_insert on public.validations
  for insert to authenticated with check (
    public.is_project_member(project_id::text)
  );

-- ------------------------------------------------------------
-- 8. INVITES — owner uniquement. AUCUN accès client direct :
--    le rachat passe par la RPC redeem_invite (anti-énumération)
-- ------------------------------------------------------------
drop policy if exists invites_owner on public.invites;
create policy invites_owner on public.invites
  for all to authenticated
  using (public.is_project_owner(project_id::text))
  with check (public.is_project_owner(project_id::text));

-- ------------------------------------------------------------
-- 9. PROJECT_MEMBERS — lecture : soi-même + l'owner du projet.
--    Pas de policy d'écriture : insertion via redeem_invite only.
-- ------------------------------------------------------------
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated using (
    user_id = auth.uid() or public.is_project_owner(project_id::text)
  );

-- Un client peut quitter un projet (supprimer SA propre ligne) ;
-- l'owner peut retirer un membre.
drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete to authenticated using (
    user_id = auth.uid() or public.is_project_owner(project_id::text)
  );

-- ------------------------------------------------------------
-- 10. STAGES (hérité, plus utilisé par l'UI) — owner only
-- ------------------------------------------------------------
drop policy if exists stages_owner on public.stages;
create policy stages_owner on public.stages
  for all to authenticated
  using (public.is_project_owner(project_id::text))
  with check (public.is_project_owner(project_id::text));

-- ============================================================
-- RPC — actions client contrôlées (SECURITY DEFINER)
-- ============================================================

-- Rachat d'un code d'invitation : valide existence + expiration +
-- usage unique, puis inscrit le membre. Renvoie du JSON.
create or replace function public.redeem_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select * into inv from invites where upper(code) = upper(trim(p_code)) limit 1;

  if inv is null then
    return json_build_object('ok', false, 'error', 'Code invalide ou introuvable.');
  end if;

  -- Déjà membre (ex. nouvelle machine) → on laisse passer
  if exists (select 1 from project_members
             where project_id = inv.project_id and user_id = auth.uid()) then
    return json_build_object('ok', true, 'project_id', inv.project_id);
  end if;

  if inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'Ce code a déjà été utilisé.');
  end if;

  if inv.expires_at is null or inv.expires_at < now() then
    return json_build_object('ok', false, 'error', 'Ce code a expiré. Demandez-en un nouveau.');
  end if;

  update invites set accepted_at = now() where id = inv.id;
  insert into project_members (project_id, user_id)
    values (inv.project_id, auth.uid())
    on conflict do nothing;

  return json_build_object('ok', true, 'project_id', inv.project_id);
end;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- Changement de statut projet — owner OU membre, statuts whitelistés.
-- (Le client valide/refuse → statut, sans pouvoir toucher au reste du projet.)
create or replace function public.set_project_status(p_project_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('draft', 'revise', 'validated', 'delivered') then
    raise exception 'Statut invalide';
  end if;

  update projects p
     set status = p_status
   where p.id::text = p_project_id
     and (p.owner_id = auth.uid()
          or exists (select 1 from project_members m
                     where m.project_id = p.id and m.user_id = auth.uid()));

  if not found then
    raise exception 'Projet introuvable ou accès refusé';
  end if;
end;
$$;

revoke all on function public.set_project_status(text, text) from public, anon;
grant execute on function public.set_project_status(text, text) to authenticated;

-- Approbation d'une photo — owner OU membre, ne touche QUE approval.
create or replace function public.set_media_approval(p_media_id text, p_approval text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_approval is not null and p_approval not in ('approved', 'revise') then
    raise exception 'Valeur d''approbation invalide';
  end if;

  update media md
     set approval = p_approval
   where md.id::text = p_media_id
     and exists (select 1 from projects p
                 where p.id = md.project_id
                   and (p.owner_id = auth.uid()
                        or exists (select 1 from project_members m
                                   where m.project_id = p.id and m.user_id = auth.uid())));

  if not found then
    raise exception 'Média introuvable ou accès refusé';
  end if;
end;
$$;

revoke all on function public.set_media_approval(text, text) from public, anon;
grant execute on function public.set_media_approval(text, text) to authenticated;

-- Favori ♥ d'une photo — owner OU membre, ne touche QUE starred.
create or replace function public.set_media_starred(p_media_id text, p_starred boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update media md
     set starred = p_starred
   where md.id::text = p_media_id
     and exists (select 1 from projects p
                 where p.id = md.project_id
                   and (p.owner_id = auth.uid()
                        or exists (select 1 from project_members m
                                   where m.project_id = p.id and m.user_id = auth.uid())));

  if not found then
    raise exception 'Média introuvable ou accès refusé';
  end if;
end;
$$;

revoke all on function public.set_media_starred(text, boolean) from public, anon;
grant execute on function public.set_media_starred(text, boolean) to authenticated;

-- ============================================================
-- Realtime : s'assurer que les tables sont publiées
-- (sans erreur si déjà fait)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['projects','media','comments','validations','stages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end;
$$;
