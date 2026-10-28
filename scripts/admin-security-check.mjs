import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;
grant usage on schema auth,storage to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
for(const file of ['202610190001_core.sql','202610190002_media_and_operations.sql','202610190003_store_checkout.sql','202610240004_customer_relationships.sql','202610260009_admin_sales.sql'])await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto with schema extensions;',''));
const customer='11111111-1111-4111-a111-111111111111',other='22222222-2222-4222-a222-222222222222',admin='33333333-3333-4333-a333-333333333333';
await db.exec(`insert into auth.users(id,email) values('${customer}','customer@example.test'),('${other}','other@example.test'),('${admin}','admin@example.test');update public.profiles set role='administrator' where id='${admin}';insert into public.categories(slug,name) values('living','Living');insert into public.products(slug,category_id,name,brand,reference,source_url,demo_price_paisa) select 'security-test',id,'Test sofa','ESSYRA','{}','https://example.test',100000 from public.categories;insert into public.variants(product_id,sku,color,materials,price_paisa,stock_on_hand) select id,'TEST-SKU','Brown',array['Wood'],100000,5 from public.products;`);
async function login(id,aal='aal1',anonymous=false){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({is_anonymous:anonymous,aal})}',false);set role authenticated;`)}
async function denied(sql,label){await assert.rejects(db.exec(sql),undefined,label)}
const sale=`select public.admin_set_product_sale('security-test',100000,70000)`;
await db.exec(`set role anon`);await denied(sale,'anonymous sale update');await denied('select * from public.store_orders','anonymous order access');await denied('select * from public.customer_contacts','anonymous contacts access');
await login(customer,'aal2');assert.equal((await db.query('select count(*)::int n from public.customer_contacts')).rows[0].n,1);await denied(sale,'customer sale write even with MFA');await denied(`update public.profiles set role='administrator' where id='${customer}'`,'customer cannot self-promote');await denied(`select public.admin_update_product('security-test',1,1,true)`,'customer catalogue write');await denied(`select public.admin_create_product('{}',1,1)`,'customer product create');await denied(`select public.admin_update_settings('{}')`,'customer settings write');
await login(admin);await denied(sale,'administrator sale write without MFA');assert.equal((await db.query('select count(*)::int n from public.customer_contacts')).rows[0].n,1);
await login(admin,'aal2');assert.equal((await db.query('select count(*)::int n from public.customer_contacts')).rows[0].n,3);await denied(sale.replace('70000','100000'),'non-discount rejected');await denied(sale.replace('100000','200000'),'invented original price rejected');await db.exec(sale);assert.equal((await db.query('select demo_price_paisa::int p from public.products')).rows[0].p,70000);assert.equal((await db.query('select price_paisa::int p from public.variants')).rows[0].p,70000);await denied(`select public.admin_set_product_sale('security-test',null,90000)`,'ending sale cannot set arbitrary price');await db.exec(`select public.admin_set_product_sale('security-test',null,100000)`);assert.equal((await db.query('select reference from public.products')).rows[0].reference.saleOriginalPrice,undefined);
// Exercise the same cancellation and fulfilment routines used by the live order editor.
const cancelOrder='44444444-4444-4444-a444-444444444444',deliveryOrder='55555555-5555-4555-a555-555555555555';
await db.exec(`reset role;insert into public.store_orders(id,owner_id,request_key,input_hash,customer_name,phone,city,delivery_address,payment_method,total_paisa,snapshot) values('${cancelOrder}','${customer}',gen_random_uuid(),'fixture-a','Local test','03000000000','Test city','Local fixture address','cod',100000,'[]'),('${deliveryOrder}','${customer}',gen_random_uuid(),'fixture-b','Local test','03000000000','Test city','Local fixture address','cod',100000,'[]');`);
await login(customer,'aal2');await denied(`select manage_store_order('${cancelOrder}','cancelled')`,'customer cannot cancel through staff routine');
await login(admin);await denied(`select manage_store_order('${cancelOrder}','cancelled')`,'staff cancellation requires MFA');
await login(admin,'aal2');await db.exec(`select manage_store_order('${cancelOrder}','cancelled')`);
assert.equal((await db.query(`select order_state from store_orders where id='${cancelOrder}'`)).rows[0].order_state,'cancelled');
await denied(`select manage_store_order('${cancelOrder}','processing')`,'cancelled order cannot be reopened');
await db.exec(`select manage_store_order('${deliveryOrder}','processing');select manage_store_order('${deliveryOrder}','dispatched');select manage_store_order('${deliveryOrder}','delivered','Test courier','Test tracking',true)`);
assert.equal((await db.query(`select payment_state from store_orders where id='${deliveryOrder}'`)).rows[0].payment_state,'paid');
await db.exec(`reset role;update public.profiles set active=false where id='${admin}'`);await login(admin,'aal2');await denied(sale,'inactive administrator denied');
console.log('Passed: anonymous denial, customer isolation, role escalation denial, customer admin-RPC denial, admin MFA requirement, inactive-admin denial, sale price validation, original-price integrity, variant checkout price consistency and sale restoration. No production data used.');await db.close();
