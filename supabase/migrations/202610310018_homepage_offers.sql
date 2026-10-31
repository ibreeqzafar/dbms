begin;
-- Owner-authorised homepage offers; regular prices remain the saved catalogue prices.
do $$
declare offer record; item public.products; regular bigint; discounted bigint;
begin
 for offer in select * from (values
 ('square-bubble-boucle-bed',40),('cloud-plus-sofa',40),
 ('credenza-console-with-curved-cabinets-brass-accents',40),('curvy-standing-mirror-with-full-length-design',40),
 ('zarelle-bed',10),('kate-white-sofa',10),('leaf-media-console',10),('arch-bubble-sofa',10)
 ) as offers(slug,percent_off)
 loop
  select * into item from public.products where slug=offer.slug and active for update;
  if not found then raise exception 'Featured sale product unavailable: %',offer.slug;end if;
  regular:=coalesce((item.reference->>'saleOriginalPrice')::numeric*100,item.demo_price_paisa)::bigint;
  discounted:=round(regular*(100-offer.percent_off)::numeric/100)::bigint;
  if discounted<=0 or discounted>=regular then raise exception 'Invalid discount';end if;
  update public.products set demo_price_paisa=discounted,reference=reference||jsonb_build_object('saleOriginalPrice',regular::numeric/100),updated_at=now() where id=item.id;
  update public.variants set price_paisa=discounted where product_id=item.id;
  insert into public.audit_logs(actor_id,action,entity_id,metadata) values(null,'homepage-offer-published',item.id,jsonb_build_object('regular_paisa',regular,'sale_paisa',discounted,'percent_off',offer.percent_off));
 end loop;
end $$;
commit;
select slug,(reference->>'saleOriginalPrice')::numeric as regular_pkr,demo_price_paisa/100.0 as sale_pkr,
 round(100*(1-demo_price_paisa/((reference->>'saleOriginalPrice')::numeric*100))) as percent_off
from public.products where slug in ('square-bubble-boucle-bed','cloud-plus-sofa','credenza-console-with-curved-cabinets-brass-accents','curvy-standing-mirror-with-full-length-design','zarelle-bed','kate-white-sofa','leaf-media-console','arch-bubble-sofa') order by percent_off desc,slug;
