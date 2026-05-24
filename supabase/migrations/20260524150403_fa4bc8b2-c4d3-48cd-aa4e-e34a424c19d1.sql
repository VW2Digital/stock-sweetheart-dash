
-- ============ schema_backups table ============
CREATE TABLE IF NOT EXISTS public.schema_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  size_bytes integer NOT NULL DEFAULT 0,
  sql_content text NOT NULL,
  created_by uuid NULL,
  CONSTRAINT schema_backups_source_check CHECK (source IN ('auto','manual'))
);

CREATE INDEX IF NOT EXISTS idx_schema_backups_created_at ON public.schema_backups (created_at DESC);

ALTER TABLE public.schema_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage schema backups" ON public.schema_backups;
CREATE POLICY "Admins manage schema backups"
  ON public.schema_backups FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ generate_schema_dump() ============
CREATE OR REPLACE FUNCTION public.generate_schema_dump()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  _out text := '';
  _rec record;
  _cols text;
BEGIN
  _out := '-- =====================================================' || E'\n';
  _out := _out || '-- Schema dump (public) — gerado em ' || now()::text || E'\n';
  _out := _out || '-- =====================================================' || E'\n\n';

  -- Enums / custom types
  _out := _out || '-- ============ ENUMS / TYPES ============' || E'\n';
  FOR _rec IN
    SELECT n.nspname, t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY n.nspname, t.typname
    ORDER BY t.typname
  LOOP
    _out := _out || format('CREATE TYPE %I.%I AS ENUM (%s);', _rec.nspname, _rec.typname, _rec.labels) || E'\n';
  END LOOP;
  _out := _out || E'\n';

  -- Sequences
  _out := _out || '-- ============ SEQUENCES ============' || E'\n';
  FOR _rec IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  LOOP
    _out := _out || format('CREATE SEQUENCE IF NOT EXISTS %I.%I;', _rec.sequence_schema, _rec.sequence_name) || E'\n';
  END LOOP;
  _out := _out || E'\n';

  -- Tables
  _out := _out || '-- ============ TABLES ============' || E'\n';
  FOR _rec IN
    SELECT c.oid, n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    SELECT string_agg(
      format('  %I %s%s%s',
        a.attname,
        pg_catalog.format_type(a.atttypid, a.atttypmod),
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        COALESCE(' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid), '')
      ),
      E',\n'
      ORDER BY a.attnum
    ) INTO _cols
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = _rec.oid AND a.attnum > 0 AND NOT a.attisdropped;

    _out := _out || format('CREATE TABLE IF NOT EXISTS %I.%I (', _rec.schemaname, _rec.tablename) || E'\n'
                 || COALESCE(_cols, '') || E'\n);\n';
  END LOOP;
  _out := _out || E'\n';

  -- Constraints (PK, FK, UNIQUE, CHECK)
  _out := _out || '-- ============ CONSTRAINTS ============' || E'\n';
  FOR _rec IN
    SELECT n.nspname AS schemaname,
           cls.relname AS tablename,
           con.conname,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY cls.relname, con.conname
  LOOP
    _out := _out || format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s;',
                           _rec.schemaname, _rec.tablename, _rec.conname, _rec.def) || E'\n';
  END LOOP;
  _out := _out || E'\n';

  -- Indexes (skip those created by constraints)
  _out := _out || '-- ============ INDEXES ============' || E'\n';
  FOR _rec IN
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT IN (
        SELECT con.conname FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND con.contype IN ('p','u')
      )
    ORDER BY tablename, indexname
  LOOP
    _out := _out || _rec.indexdef || ';' || E'\n';
  END LOOP;
  _out := _out || E'\n';

  -- RLS enable + policies
  _out := _out || '-- ============ RLS + POLICIES ============' || E'\n';
  FOR _rec IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY c.relname
  LOOP
    _out := _out || format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;',
                           _rec.schemaname, _rec.tablename) || E'\n';
  END LOOP;
  _out := _out || E'\n';

  FOR _rec IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    _out := _out || format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
      _rec.policyname, _rec.schemaname, _rec.tablename,
      _rec.permissive, _rec.cmd,
      array_to_string(_rec.roles, ', '),
      COALESCE(' USING (' || _rec.qual || ')', ''),
      COALESCE(' WITH CHECK (' || _rec.with_check || ')', '')
    ) || E'\n';
  END LOOP;
  _out := _out || E'\n';

  -- Functions
  _out := _out || '-- ============ FUNCTIONS ============' || E'\n';
  FOR _rec IN
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY p.proname
  LOOP
    _out := _out || _rec.def || E';\n\n';
  END LOOP;

  -- Triggers
  _out := _out || '-- ============ TRIGGERS ============' || E'\n';
  FOR _rec IN
    SELECT pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  LOOP
    _out := _out || _rec.def || ';' || E'\n';
  END LOOP;
  _out := _out || E'\n';

  RETURN _out;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.generate_schema_dump() FROM PUBLIC, anon, authenticated;

-- ============ create_schema_backup() ============
CREATE OR REPLACE FUNCTION public.create_schema_backup(_source text DEFAULT 'manual')
RETURNS public.schema_backups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _dump text;
  _row public.schema_backups;
  _uid uuid := auth.uid();
BEGIN
  IF _source NOT IN ('auto','manual') THEN
    _source := 'manual';
  END IF;

  _dump := public.generate_schema_dump();

  INSERT INTO public.schema_backups (source, size_bytes, sql_content, created_by)
  VALUES (_source, octet_length(_dump), _dump, _uid)
  RETURNING * INTO _row;

  -- Keep only the latest 30
  DELETE FROM public.schema_backups
  WHERE id IN (
    SELECT id FROM public.schema_backups
    ORDER BY created_at DESC
    OFFSET 30
  );

  RETURN _row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.create_schema_backup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_schema_backup(text) TO authenticated, service_role;

-- ============ Daily cron job 03:00 UTC ============
DO $$
BEGIN
  PERFORM cron.unschedule('schema-backup-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'schema-backup-daily',
  '0 3 * * *',
  $$SELECT public.create_schema_backup('auto');$$
);
