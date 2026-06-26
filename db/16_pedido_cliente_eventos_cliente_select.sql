-- ============================================================
-- Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A
-- Policy SELECT versionada para timeline futura do cliente B2B.
--
-- Escopo:
--   - Liberar somente SELECT do cliente em public.pedido_cliente_eventos.
--   - Restringir leitura a eventos visiveis de pedidos proprios.
--   - Preservar policy admin existente e RLS habilitada.
--
-- Nao implementado nesta fase:
--   - Aplicacao do SQL no Supabase.
--   - Frontend cliente/admin.
--   - Timeline read-only no detalhe do pedido.
--   - INSERT/UPDATE/DELETE de cliente.
--   - View, RPC, trigger ou automacao.
--
-- Governanca:
--   - Respeita docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md
--   - RLS controla linha, nao coluna.
--   - O frontend futuro do cliente deve selecionar apenas:
--     id, pedido_id, status, titulo, mensagem, criado_em.
--   - Nao selecionar metadata no cliente na fase seguinte.
--
-- Idempotente: pode rodar varias vezes sem efeito cumulativo.
-- Sem DELETE destrutivo, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Policy cliente SELECT em public.pedido_cliente_eventos
-- ============================================================

DROP POLICY IF EXISTS pedido_cliente_eventos_cliente_select
  ON public.pedido_cliente_eventos;

CREATE POLICY pedido_cliente_eventos_cliente_select
  ON public.pedido_cliente_eventos
  FOR SELECT
  USING (
    visivel_cliente = true
    AND EXISTS (
      SELECT 1
      FROM public.pedidos p
      WHERE p.id = pedido_cliente_eventos.pedido_id
        AND p.cliente_id = public.meu_cliente_id()
    )
  );


-- ============================================================
-- 2. Comentarios de semantica
-- ============================================================
-- - Esta policy libera apenas leitura de eventos marcados como
--   visiveis ao cliente.
-- - A ownership continua ancorada em public.pedidos, via
--   p.cliente_id = public.meu_cliente_id().
-- - Nenhum write de cliente e liberado nesta fase.
-- - pedido_cliente_eventos_admin_all permanece necessario para admin.
-- - A timeline do cliente continua pendente no frontend.
-- ============================================================
