-- Administrator sale controls. No user is promoted and no product price is changed on installation.
begin;
create function public.admin_set_product_sale(p_slug text,p_original bigint,p_price bigint)
returns void language plpgsql security definer set search_path='' as $$
declare p public.products;begin
 if not private.is_admin() then raise exception 'Active administrator with MFA required' using errcode='42501';end if;
 if p_price is null or p_price<=0 or (p_original is not null and p_original<=p_price) then raise exception 'Sale price must be positive and below the original price';end if;
 select * into p from public.products where slug=p_slug for update;
 if not found then raise exception 'Unknown product';end if;
 -- The crossed-out price must come from the stored pre-sale price, never an invented higher number.
 if p_original is not null and p_original<>coalesce((p.reference->>'saleOriginalPrice')::numeric*100,p.demo_price_paisa) then raise exception 'Original price must match the saved regular price';end if;
 if p_original is null and p_price<>coalesce((p.reference->>'saleOriginalPrice')::numeric*100,p.demo_price_paisa) then raise exception 'Ending a sale restores its saved regular price';end if;
 update public.products set demo_price_paisa=p_price,reference=case when p_original is null then reference-'saleOriginalPrice' else reference||jsonb_build_object('saleOriginalPrice',p_original::numeric/100) end,updated_at=now() where id=p.id;
 update public.variants set price_paisa=p_price where product_id=p.id;
 insert into public.audit_logs(actor_id,action,entity_id,metadata) values(auth.uid(),'product-sale-updated',p.id,jsonb_build_object('original_paisa',p_original,'price_paisa',p_price));
end$$;
revoke all on function public.admin_set_product_sale(text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.admin_set_product_sale(text,bigint,bigint) to authenticated;
commit;
