begin;
create temporary table sofa_price_changes(slug text primary key,old_paisa bigint,new_paisa bigint) on commit drop;
insert into sofa_price_changes values
('klippan-2-seat-sofa-flackarp-medium-grey-s89246862',2200000,1320000),
('ektorp-3-seat-sofa-mangbyn-brown-multicolour-s59619759',8300000,4980000),
('ektorp-3-seat-sofa-kilanda-light-beige-s29509012',11625000,6975000),
('ektorp-3-seat-sofa-kilanda-dark-blue-s89509009',12575000,7545000),
('ektorp-3-seat-sofa-hakebo-grey-green-s19509003',16850000,10110000),
('ektorp-3-seat-sofa-alhamn-dark-grey-blue-s59628706',19225000,11535000),
('glostad-3-seat-sofa-knisa-dark-grey-80595940',21125000,12675000),
('ektorp-3-seat-sofa-hakebo-dark-grey-s79509000',23025000,13815000),
('ektorp-3-seat-sofa-blekinge-white-s29628703',25400000,15240000),
('valnaes-2-seat-sofa-knaebaeck-light-beige-s69615322',26825000,16095000),
('valnaes-2-seat-sofa-alhamn-dark-yellow-brown-s39615328',28725000,17235000),
('kivik-3-seat-sofa-tibbleby-beige-grey-s69440596',1400000,840000),
('valnaes-2-seat-sofa-alhamn-dark-grey-blue-s99615325',3300000,1980000),
('kivik-3-seat-sofa-kelinge-grey-turquoise-s79443052',4250000,2550000),
('kivik-3-seat-sofa-tallmyra-blue-s89500476',4725000,2835000),
('kivik-3-seat-sofa-tresund-anthracite-s79482835',5675000,3405000),
('kivik-3-seat-sofa-tallmyra-medium-grey-s29500479',7100000,4260000),
('kivik-3-seat-sofa-tresund-light-beige-s59482836',8050000,4830000),
('kivik-3-seat-sofa-tallmyra-white-black-s69500482',12325000,7395000),
('saltmyran-3-seat-sofa-oereryd-grey-beige-70618517',13750000,8250000),
('kivik-2-seat-sofa-tibbleby-beige-grey-s29440598',15175000,9105000),
('saltmyran-3-seat-sofa-oereryd-blue-90618521',16125000,9675000),
('kivik-2-seat-sofa-kelinge-grey-turquoise-s79443047',20875000,12525000),
('kivik-2-seat-sofa-tallmyra-blue-s59500468',22300000,13380000),
('kivik-2-seat-sofa-tallmyra-dark-green-s39500469',23250000,13950000),
('kivik-2-seat-sofa-tallmyra-white-black-s39500474',26100000,15660000),
('kivik-2-seat-sofa-tresund-light-beige-s69482826',27050000,16230000),
('hyltarp-3-seat-sofa-gransel-natural-s09489637',29425000,17655000),
('hyltarp-3-seat-sofa-tallmyra-blue-s69514945',1625000,975000),
('kivik-2-seat-sofa-tresund-anthracite-s89482825',3525000,2115000),
('hyltarp-3-seat-sofa-hemmesta-light-beige-s79514940',4000000,2400000),
('hyltarp-3-seat-sofa-gransel-grey-brown-s39489631',8750000,5250000),
('hyltarp-3-seat-sofa-tallmyra-dark-green-s49514951',9700000,5820000),
('hyltarp-3-seat-sofa-hallarp-white-s89489643',11600000,6960000),
('hyltarp-3-seat-sofa-gransel-grey-s09514929',12550000,7530000),
('gullvalla-3-seat-sofa-silkeryd-dark-grey-beige-50618504',14450000,8670000),
('gullvalla-3-seat-sofa-silkeryd-grey-green-60618513',15400000,9240000),
('glostad-3-seat-sofa-with-chaise-longue-knisa-dark-grey-s89578601',17775000,10665000);
do $$begin if exists(select 1 from sofa_price_changes c left join public.products p on p.slug=c.slug where p.id is null or p.demo_price_paisa not in(c.old_paisa,c.new_paisa)) then raise exception 'A sofa price changed unexpectedly; review before updating';end if;if exists(select 1 from public.variants v join public.products p on p.id=v.product_id join sofa_price_changes c on c.slug=p.slug where v.price_paisa not in(c.old_paisa,c.new_paisa)) then raise exception 'A variant price changed unexpectedly; review before updating';end if;end$$;
update public.products p set demo_price_paisa=c.new_paisa,updated_at=now() from sofa_price_changes c where p.slug=c.slug and p.demo_price_paisa=c.old_paisa;
update public.variants v set price_paisa=c.new_paisa from public.products p join sofa_price_changes c on p.slug=c.slug where v.product_id=p.id and v.price_paisa=c.old_paisa;
select count(*) as sofas, min(p.demo_price_paisa)/100 as min_pkr,max(p.demo_price_paisa)/100 as max_pkr from public.products p join sofa_price_changes c on p.slug=c.slug;
commit;