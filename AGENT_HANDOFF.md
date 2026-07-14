# HANDOFF OPERACIONAL ATIVO

- **Frente:** G28 — D4 canonical decision wiring para `#/documentos/recebidos` — `CLOSED / ACCEPTED`
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **HEAD final D4:** `ae907b82613c87c5a9f2cd37031186ef94047db7` — `Wire canonical document decision runtime`
- **Arquivos do commit técnico:** `js/screens/documentos-recebidos.js`, `tests/documentos-recebidos.smoke.js`, `tests/documentos-recebidos-decision-integration.test.js` e este handoff.
- **Implementação aceita:** a tela envia somente `doc.raw._ravatex_source === 'supabase'` ao controller D3 → lifecycle D2 → adapter D1; `raw._ravatex_server_decision` alimenta `activeDecision`; `restorePending()` ocorre uma vez na montagem; pending `uncertain` do mesmo documento abre o modal sem `open()` e confirma com `retry()` preservando command ID. O caminho legado `saveDocumentDecision`/`statusOverrides` não foi alterado.
- **Agentes/modelos:** diagnóstico, gate e correção mínima por IAsup `gpt-5.6-terra`; implementação inicial rejeitada por OpenCode `opencode/deepseek-v4-flash-free` (violação de allowlist/timeout); Pro e Kimi indisponíveis por `UnknownError`; revisão independente read-only por OpenCode `opencode-go/deepseek-v4-flash`, `exit 0`, `APPROVE`, sem mutação.
- **Evidências:** TDD RED falhou em `reconcileCalls 0 !== 1`; GREEN e gate final: `node --check` + sete suítes D4, `454 pass, 0 fail`; `git diff --check` e check do arquivo novo limpos; revisão externa aprovada.
- **Git final técnico:** commit local criado; nenhum push, rede, Supabase, migration ou produção acessados em D4.
- **Riscos residuais:** somente o aviso não bloqueante Git LF→CRLF para o novo teste; nenhuma pendência técnica D4 identificada.
- **Próximo passo:** não iniciar D5 nem qualquer mudança remota/DB/UI adicional sem nova autorização explícita.

# HISTÓRICO DE HANDOFFS — ARQUIVADO

O conteúdo histórico completo dos handoffs anteriores foi preservado,
byte a byte, em:

`docs/legacy/pre-model/AGENT_HANDOFF_FULL_SNAPSHOT.md`

Manifesto de integridade:

`docs/legacy/pre-model/MANIFEST.md`

Commit de origem do snapshot:

`08b9af5e251de48e938600e5e4b4214e4d1e824e`

SHA-256 do snapshot completo:

`386810890675714527fc349fa29ddab3fe977dd80c0b270899a7b1a2b3a24b4d`

O snapshot é exclusivamente histórico. Não representa o handoff ativo,
não deve ser editado e não deve receber novos closeouts.

Esta seção não deve acumular novo conteúdo histórico.
