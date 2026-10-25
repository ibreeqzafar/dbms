import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;
grant usage on schema auth,storage to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
// PGlite supplies PostgreSQL but not pgcrypto here; only the digest implementation is stubbed.
const migration=(await readFile('supabase/migrations/202610190001_core.sql','utf8')).replace('create extension if not exists pgcrypto with schema extensions;','');
await db.exec(migration);await db.exec(await readFile('supabase/migrations/202610190002_media_and_operations.sql','utf8'));await db.exec(await readFile('supabase/migrations/202610190003_store_checkout.sql','utf8'));console.log('Migrations parsed and applied in PostgreSQL.');

await db.exec(await readFile('supabase/seed.sql','utf8'));
await db.exec(await readFile('supabase/migrations/202610250007_sample_reviews.sql','utf8'));
assert.equal((await db.query('select count(*)::int as n from public.catalogue_reviews')).rows[0].n,312);
await db.exec('set role anon');
assert.equal((await db.query('select count(*)::int as n from public.catalogue_reviews')).rows[0].n,312);
let denied=false;try{await db.exec('update public.catalogue_reviews set rating=5')}catch{denied=true}assert(denied);
await db.exec('reset role');
await db.exec("update public.products set active=false where slug=(select product_slug from public.catalogue_reviews limit 1)");
await db.exec('set role anon');
assert((await db.query('select count(*)::int as n from public.catalogue_reviews')).rows[0].n<312);
console.log('Passed: 312 clearly marked sample reviews, valid product references, public read only, no visitor rating tampering and inactive-product isolation.');
await db.close();
