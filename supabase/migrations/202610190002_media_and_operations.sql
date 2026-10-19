create function public.register_room_asset(p_owner uuid,p_room uuid,p_object text,p_bytes integer,p_base boolean) returns public.room_assets language plpgsql security definer set search_path='' as $$declare asset public.room_assets;begin
 perform 1 from public.room_sessions where id=p_room and owner_id=p_owner and deleted_at is null and expires_at>now() for update;if not found then raise exception 'Room inaccessible';end if;
 if not coalesce((select granted from public.consent_records where owner_id=p_owner and room_id=p_room and kind='processing' order by created_at desc,id desc limit 1),false) then raise exception 'Processing consent required';end if;
 if (select count(*) from public.room_assets where room_id=p_room and kind='source' and deleted_at is null and expires_at>now())>=3 then raise exception 'Three source photos maximum';end if;
 if p_base then update public.room_assets set base_view=false where room_id=p_room and base_view;end if;
 insert into public.room_assets(room_id,owner_id,object_key,kind,mime,bytes,base_view) values(p_room,p_owner,p_object,'source','image/png',p_bytes,p_base) returning * into asset;return asset;end$$;
create function public.save_room_design(p_room uuid,p_assets uuid[],p_name text,p_slugs text[],p_preferences text) returns public.saved_designs language plpgsql security definer set search_path='' as $$declare d public.saved_designs;a uuid;begin
 if not private.is_customer() then raise exception 'Customer required' using errcode='42501';end if;
 perform 1 from public.room_sessions where id=p_room and owner_id=auth.uid() and deleted_at is null and expires_at>now() for update;if not found then raise exception 'Room inaccessible';end if;
 if not coalesce((select granted from public.consent_records where owner_id=auth.uid() and room_id=p_room and kind='saving' order by created_at desc,id desc limit 1),false) then raise exception 'Separate saving consent required';end if;
 if length(p_name) not between 1 and 150 or length(p_preferences)>10000 or cardinality(p_assets)>4 then raise exception 'Invalid design';end if;
 foreach a in array p_assets loop perform 1 from public.room_assets where id=a and room_id=p_room and owner_id=auth.uid() and deleted_at is null and expires_at>now();if not found then raise exception 'Asset inaccessible or expired';end if;end loop;
 insert into public.saved_designs(owner_id,room_id,name,product_slugs,preferences) values(auth.uid(),p_room,p_name,p_slugs,p_preferences) returning * into d;
 foreach a in array p_assets loop insert into public.saved_design_assets(design_id,asset_id) values(d.id,a);end loop;return d;end$$;
create function public.delete_design(p_design uuid) returns void language plpgsql security definer set search_path='' as $$declare r uuid;begin
 select room_id into r from public.saved_designs where id=p_design and owner_id=auth.uid();if not found then raise exception 'Design inaccessible' using errcode='42501';end if;delete from public.saved_designs where id=p_design and owner_id=auth.uid();if r is not null and not exists(select 1 from public.saved_designs where room_id=r) then perform public.delete_room(r);end if;end$$;
create function public.maintenance_expired() returns void language plpgsql security definer set search_path='' as $$declare j record;begin
 update public.room_sessions set deleted_at=now() where expires_at<=now() and deleted_at is null;
 update public.room_assets a set deleted_at=now() where a.deleted_at is null and (a.expires_at<=now() or exists(select 1 from public.room_sessions r where r.id=a.room_id and r.deleted_at is not null));
 insert into public.cleanup_tasks(asset_id,object_key) select id,object_key from public.room_assets where deleted_at is not null on conflict do nothing;
 for j in select id from public.preview_jobs where state in('queued','running','provider-pending') and (expires_at<=now() or exists(select 1 from public.room_sessions r where r.id=room_id and r.deleted_at is not null)) for update skip locked loop update public.preview_jobs set state='expired' where id=j.id;perform public.finalize_preview(j.id,false);end loop;
 -- An expired lease without a known outcome needs reconciliation, never automatic duplicate submission.
 update public.preview_jobs set state='provider-pending',error_code='LEASE_EXPIRED_RECONCILE',lease_until=null where state='running' and lease_until<now();
 -- Search uses generated PostgreSQL tsvector, already refreshed in the catalogue transaction.
 update public.search_update_events set state='completed',attempts=attempts+1 where state='pending' and attempts<3;
end$$;
create function public.admin_create_product(p_reference jsonb,p_price bigint,p_stock integer) returns uuid language plpgsql security definer set search_path='' as $$declare pid uuid;cid uuid;vid uuid;c text;begin
 if not private.is_admin() then raise exception 'Administrator with MFA required' using errcode='42501';end if;
 if length(p_reference->>'name') not between 2 and 150 or (p_reference->>'sourceUrl')!~'^https://' or (p_reference->>'id')!~'^[a-z0-9][a-z0-9-]{2,150}$' or p_price<0 or p_stock<0 or jsonb_array_length(p_reference->'colors')<1 then raise exception 'Invalid reference';end if;
 select id into cid from public.categories where slug=p_reference->>'category';if cid is null then raise exception 'Unknown category';end if;
 insert into public.products(slug,category_id,name,brand,reference,source_url,demo_price_paisa) values(p_reference->>'id',cid,p_reference->>'name',p_reference->>'brand',p_reference,p_reference->>'sourceUrl',p_price) returning id into pid;
 for c in select string_agg(value,' / ') from jsonb_array_elements_text(p_reference->'colors') loop vid:=gen_random_uuid();insert into public.variants(id,product_id,sku,color,materials,width_cm,depth_cm,height_cm,price_paisa,stock_on_hand) values(vid,pid,'ESS-'||(upper(p_reference->>'id')),c,array(select jsonb_array_elements_text(p_reference->'materials')),(p_reference->'dimensions'->>'width')::numeric,(p_reference->'dimensions'->>'depth')::numeric,(p_reference->'dimensions'->>'height')::numeric,p_price,p_stock);end loop;
 insert into public.audit_logs(actor_id,action,entity_id) values(auth.uid(),'catalogue-created',pid);insert into public.search_update_events(product_id) values(pid);return pid;end$$;
revoke all on function public.register_room_asset(uuid,uuid,text,integer,boolean),public.save_room_design(uuid,uuid[],text,text[],text),public.delete_design(uuid),public.maintenance_expired(),public.admin_create_product(jsonb,bigint,integer) from public,anon,authenticated;
grant execute on function public.register_room_asset(uuid,uuid,text,integer,boolean),public.maintenance_expired() to service_role;
grant execute on function public.save_room_design(uuid,uuid[],text,text[],text),public.delete_design(uuid),public.admin_create_product(jsonb,bigint,integer) to authenticated;
