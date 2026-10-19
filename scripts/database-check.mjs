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
await db.exec(migration);await db.exec(await readFile('supabase/migrations/202610190002_media_and_operations.sql','utf8'));console.log('Migration parsed and applied in PostgreSQL.');
const alice='11111111-1111-4111-a111-111111111111',bob='22222222-2222-4222-a222-222222222222',guest='33333333-3333-4333-a333-333333333333';
await db.exec(`insert into auth.users(id) values('${alice}'),('${bob}'),('${guest}');
insert into public.categories(id,slug,name) values('44444444-4444-4444-a444-444444444444','living','Living room');
insert into public.products(id,slug,category_id,name,brand,reference,source_url,demo_price_paisa) values('55555555-5555-4555-a555-555555555555','table','44444444-4444-4444-a444-444444444444','Reference table','IKEA','{"name":"Reference table"}','https://www.ikea.com/',100000);
insert into public.variants(id,product_id,sku,color,materials,price_paisa,stock_on_hand) values('66666666-6666-4666-a666-666666666666','55555555-5555-4555-a555-555555555555','ESS-TABLE','brown',array['wood'],100000,2);`);
async function asUser(id,anonymous=false){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"is_anonymous":${anonymous},"aal":"aal1"}',false);set role authenticated;`)}
async function fails(sql,message){let error=false;try{await db.exec(sql)}catch{error=true}assert(error,message)}
await asUser(alice);const checkout=`select public.demo_checkout('77777777-7777-4777-a777-777777777777','[{"productId":"table","variant":"brown","quantity":1}]','Fictional practice address',100000)`;
await db.exec(checkout);await db.exec(checkout);const stock=await db.query('select stock_on_hand from public.variants');assert.equal(stock.rows[0].stock_on_hand,1);const own=await db.query('select * from public.orders');assert.equal(own.rows.length,1);await fails(`select public.demo_checkout('88888888-8888-4888-a888-888888888888','[{"productId":"table","variant":"brown","quantity":2}]','Fictional practice address',200000)`,'must reject overselling');await fails(`select public.demo_checkout('88888888-8888-4888-a888-888888888888','[{"productId":"table","variant":"brown","quantity":1}]','Fictional practice address',90000)`,'must reject changed price');
await asUser(bob);assert.equal((await db.query('select * from public.orders')).rows.length,0);await fails(`select public.admin_update_product('table',1,100,true)`,'must reject customer admin writes');await fails(`update public.profiles set role='administrator' where id='${bob}'`,'must reject role escalation');
await asUser(guest,true);await fails(checkout,'guest must not checkout');await fails(`select public.reserve_preview('99999999-9999-4999-a999-999999999999','99999999-9999-4999-a999-999999999999','66666666-6666-4666-a666-666666666666','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')`,'unconfigured provider must not reserve credits');
await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from public.quota_entries')).rows[0].n,0);
await db.exec(`update public.settings set value=value||'{"realPreviewsEnabled":true}'::jsonb where id='public';
insert into public.room_sessions(id,owner_id) values('99999999-9999-4999-a999-999999999999','${guest}');
insert into public.room_assets(id,room_id,owner_id,object_key,kind,mime,bytes,base_view) values('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','99999999-9999-4999-a999-999999999999','${guest}','${guest}/room/source.webp','source','image/webp',500,true);
insert into public.consent_records(owner_id,room_id,kind,granted) values('${guest}','99999999-9999-4999-a999-999999999999','processing',true);`);
await asUser(guest,true);const reserve=(key)=>`select public.reserve_preview('99999999-9999-4999-a999-999999999999','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','66666666-6666-4666-a666-666666666666','${key}')`;
await db.exec(reserve('bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'));await db.exec(reserve('bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'));await db.exec(reserve('cccccccc-cccc-4ccc-accc-cccccccccccc'));await db.exec(reserve('dddddddd-dddd-4ddd-addd-dddddddddddd'));await fails(reserve('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee'),'must reject fourth guest reservation');await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from public.preview_jobs')).rows[0].n,3);assert.equal((await db.query('select reserved from public.quota_windows')).rows[0].reserved,3);
const job=(await db.query('select id from public.preview_jobs limit 1')).rows[0].id;await db.exec(`select public.finalize_preview('${job}',false);select public.finalize_preview('${job}',false);`);assert.equal((await db.query('select reserved from public.quota_windows')).rows[0].reserved,2);
await asUser(bob);assert.equal((await db.query('select * from public.preview_jobs')).rows.length,0);assert.equal((await db.query('select * from public.room_assets')).rows.length,0);
await asUser(guest,true);await db.exec(`select public.delete_room('99999999-9999-4999-a999-999999999999')`);await db.exec('reset role');assert.equal((await db.query('select reserved from public.quota_windows')).rows[0].reserved,0);
console.log('Passed: duplicate checkout, stock, price conflicts, RLS isolation, role escalation denial, guest checkout denial, disabled-provider no reservation, guest cap, duplicate jobs, once-only release and room deletion cancellation.');await db.close();
