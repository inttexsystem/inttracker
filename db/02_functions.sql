-- ============================================================
-- Funções auxiliares pra políticas RLS
-- Usam auth.uid() (id do usuário logado no JWT do Supabase)
-- ============================================================

-- Retorna TRUE se o usuário logado é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;

-- Retorna o fornecedor_id do usuário logado (NULL se não é fornecedor)
CREATE OR REPLACE FUNCTION meu_fornecedor_id()
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT fornecedor_id FROM usuarios
  WHERE id = auth.uid();
$$;

-- Garante execução pra usuário autenticado
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION meu_fornecedor_id() TO authenticated;
