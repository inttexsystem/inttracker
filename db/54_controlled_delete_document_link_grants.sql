-- ============================================================
-- Fase: RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GRANTS-54
-- Correcao de seguranca emergencial (staging-only).
--
-- Evidencia: apos SQL53, as quatro funcoes publicas mantinham
-- EXECUTE concedido a PUBLIC/anon por grants anteriores/default.
-- Esta migration apenas remove esses grants e limita EXECUTE a
-- authenticated. Nao altera corpos, SECURITY DEFINER, tabelas,
-- nem cria/altera/drop funcoes.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op(BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op(BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_op(BIGINT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remover_pedido(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remover_pedido(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.remover_pedido(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remover_op(BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remover_op(BIGINT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.remover_op(BIGINT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
