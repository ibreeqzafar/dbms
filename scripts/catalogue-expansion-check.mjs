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
const baseline=(await db.query('select slug,demo_price_paisa from public.products')).rows;
for(let i=1;i<=5;i++)await db.exec(await readFile(`scripts/catalogue-expansion-${i}.sql`,'utf8'));
const rows=(await db.query('select slug,reference,demo_price_paisa from public.products')).rows;
assert.equal(rows.length,600);
for(const prior of baseline)assert.equal(rows.find(r=>r.slug===prior.slug).demo_price_paisa,prior.demo_price_paisa);
for(const row of rows)for(const d of Object.values(row.reference.dimensions))assert(typeof d==='number'&&d>0);
assert.equal((await db.query("select name from public.categories where slug='office'")).rows[0].name,'Office');
const missing=(await db.query('select count(*)::int as count from public.variants where width_cm is null or depth_cm is null or height_cm is null')).rows[0].count;
assert.equal(missing,0);
console.log('Passed: 600 database products, complete positive dimensions, existing prices preserved, valid foreign keys and Office category.');
await db.close();
