begin;
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,
 request_key uuid not null,order_id uuid references public.store_orders,
 category text not null check(category in('general','delivery','damaged','missing','return','cancellation')),
 subject text not null check(length(subject) between 3 and 120),description text not null check(length(description) between 10 and 2000),
 state text not null default 'open' check(state in('open','in_progress','resolved','closed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,request_key)
);
create index support_tickets_owner on public.support_tickets(owner_id,updated_at desc);
create table public.support_ticket_messages (
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets,
 author_id uuid not null references auth.users,author_type text not null check(author_type in('customer','team')),
 message text not null check(length(message) between 2 and 2000),created_at timestamptz not null default now()
);
create index support_ticket_messages_thread on public.support_ticket_messages(ticket_id,created_at);
alter table public.support_tickets enable row level security;alter table public.support_ticket_messages enable row level security;
revoke all on public.support_tickets,public.support_ticket_messages from public,anon,authenticated;
grant select on public.support_tickets,public.support_ticket_messages to authenticated;
grant all on public.support_tickets,public.support_ticket_messages to service_role;
create policy support_tickets_read on public.support_tickets for select to authenticated using((owner_id=auth.uid() and private.is_customer()) or private.is_admin());
create policy support_messages_read on public.support_ticket_messages for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and ((t.owner_id=auth.uid() and private.is_customer()) or private.is_admin())));

create function public.create_support_ticket(p_key uuid,p_order uuid,p_category text,p_subject text,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets;uid uuid:=auth.uid();begin
 if not private.is_customer() then raise exception 'Sign in to contact customer care' using errcode='42501';end if;
 if p_key is null or p_category not in('general','delivery','damaged','missing','return','cancellation') or p_category is null or length(trim(p_subject)) not between 3 and 120 or p_subject is null or length(trim(p_description)) not between 10 and 2000 or p_description is null then raise exception 'Review your subject and message';end if;
 if p_order is not null and not exists(select 1 from public.store_orders where id=p_order and owner_id=uid) then raise exception 'Order unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('ticket:'||uid::text,0));
 select * into ticket from public.support_tickets where owner_id=uid and request_key=p_key;
 if found then
  if ticket.order_id is distinct from p_order or ticket.category<>p_category or ticket.subject<>trim(p_subject) or ticket.description<>trim(p_description) then raise exception 'Request changed; submit again';end if;
  return ticket.id;
 end if;
 if (select count(*) from public.support_tickets where owner_id=uid and created_at>now()-interval '24 hours')>=10 then raise exception 'Support request limit reached; call customer care';end if;
 insert into public.support_tickets(owner_id,request_key,order_id,category,subject,description) values(uid,p_key,p_order,p_category,trim(p_subject),trim(p_description)) returning * into ticket;
 return ticket.id;
end$$;
create function public.reply_support_ticket(p_ticket uuid,p_message text,p_state text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets;staff boolean:=private.is_admin();result uuid;body text:=trim(coalesce(p_message,''));begin
 select * into ticket from public.support_tickets where id=p_ticket for update;
 if not found or not (staff or (private.is_customer() and ticket.owner_id=auth.uid())) then raise exception 'Ticket unavailable' using errcode='42501';end if;
 if p_state is not null and (not staff or p_state not in('open','in_progress','resolved','closed')) then raise exception 'Administrator with MFA required' using errcode='42501';end if;
 if body='' and p_state is not null and p_state<>ticket.state then body:='Request status updated to '||replace(p_state,'_',' ')||'.';end if;
 if length(body) not between 2 and 2000 then raise exception 'Write a message between 2 and 2000 characters';end if;
 if (select count(*) from public.support_ticket_messages where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Reply limit reached; try later';end if;
 insert into public.support_ticket_messages(ticket_id,author_id,author_type,message) values(ticket.id,auth.uid(),case when staff then 'team' else 'customer' end,body) returning id into result;
 update public.support_tickets set state=case when staff then coalesce(p_state,state) else case when state in('closed','resolved') then 'open' else state end end,updated_at=now() where id=ticket.id;
 if staff then insert into public.audit_logs(actor_id,action,entity_id) values(auth.uid(),'support-ticket-updated',ticket.id);end if;
 return result;
end$$;
revoke all on function public.create_support_ticket(uuid,uuid,text,text,text),public.reply_support_ticket(uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_support_ticket(uuid,uuid,text,text,text),public.reply_support_ticket(uuid,text,text) to authenticated;
commit;
