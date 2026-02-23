
-- ==========================================
-- PHASE 3: Inventory + Shopping Lists
-- ==========================================

-- Inventory items (shared household stock)
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un',
  min_quantity NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inventory" ON public.inventory_items
  FOR SELECT USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Members can create inventory items" ON public.inventory_items
  FOR INSERT WITH CHECK (is_member_of_group(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Members can update inventory items" ON public.inventory_items
  FOR UPDATE USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Admin can delete inventory items" ON public.inventory_items
  FOR DELETE USING (has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shopping lists
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'collective' CHECK (list_type IN ('collective', 'individual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- Collective lists: all members can see; Individual: only the creator
CREATE POLICY "Members can view collective lists" ON public.shopping_lists
  FOR SELECT USING (
    is_member_of_group(auth.uid(), group_id) AND (list_type = 'collective' OR created_by = auth.uid())
  );

CREATE POLICY "Members can create lists" ON public.shopping_lists
  FOR INSERT WITH CHECK (is_member_of_group(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Creator or admin can update lists" ON public.shopping_lists
  FOR UPDATE USING (
    created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin')
  );

CREATE POLICY "Creator or admin can delete lists" ON public.shopping_lists
  FOR DELETE USING (
    created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin')
  );

CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shopping list items
CREATE TABLE public.shopping_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  purchased BOOLEAN NOT NULL DEFAULT false,
  purchased_by UUID,
  purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Can view items of visible lists" ON public.shopping_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_items.list_id
        AND is_member_of_group(auth.uid(), sl.group_id)
        AND (sl.list_type = 'collective' OR sl.created_by = auth.uid())
    )
  );

CREATE POLICY "Can insert items into own lists" ON public.shopping_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_items.list_id
        AND (sl.created_by = auth.uid() OR (sl.list_type = 'collective' AND is_member_of_group(auth.uid(), sl.group_id)))
    )
  );

CREATE POLICY "Can update items in accessible lists" ON public.shopping_list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_items.list_id
        AND (sl.created_by = auth.uid() OR (sl.list_type = 'collective' AND is_member_of_group(auth.uid(), sl.group_id)))
    )
  );

CREATE POLICY "Can delete items from own or collective lists" ON public.shopping_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_items.list_id
        AND (sl.created_by = auth.uid() OR has_role_in_group(auth.uid(), sl.group_id, 'admin'))
    )
  );

-- Indexes
CREATE INDEX idx_inventory_items_group ON public.inventory_items(group_id);
CREATE INDEX idx_shopping_lists_group ON public.shopping_lists(group_id);
CREATE INDEX idx_shopping_list_items_list ON public.shopping_list_items(list_id);
CREATE INDEX idx_inventory_low_stock ON public.inventory_items(group_id) WHERE quantity <= min_quantity;
