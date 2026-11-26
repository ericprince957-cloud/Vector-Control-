-- Cover Vectors Realty foreign keys for predictable joins and deletes.
create index if not exists realty_properties_created_by_idx on public.realty_properties(created_by);
create index if not exists realty_properties_owner_contact_idx on public.realty_properties(owner_contact_id);
create index if not exists realty_contacts_created_by_idx on public.realty_contacts(created_by);
create index if not exists realty_enquiries_property_idx on public.realty_enquiries(property_id);
create index if not exists realty_partnerships_created_by_idx on public.realty_partnerships(created_by);
create index if not exists realty_deals_property_idx on public.realty_deals(property_id);
create index if not exists realty_deals_contact_idx on public.realty_deals(contact_id);
create index if not exists realty_deals_created_by_idx on public.realty_deals(created_by);
