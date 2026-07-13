# MANIFEST — Pre-Model Documentation Snapshots

> **Finalidade:** preservação imutável anterior à compactação documental.
> **Data:** 2026-07-12
> **Branch:** `work/g28-document-qualification`
> **Commit de origem:** `08b9af5e251de48e938600e5e4b4214e4d1e824e`
> **Fase:** `G28-DOCS-B3-B0 — IMMUTABLE PRE-MODEL SNAPSHOTS`
> **Agente:** OpenCode / MiniMax-M3
> **Método de cópia:** `Copy-Item -LiteralPath` (binário, sem leitura/regravação textual, sem normalização de encoding, sem normalização de finais de linha)

## 1. Tabela de snapshots

| # | Origem (caminho relativo à raiz do workspace) | Snapshot (caminho relativo) | Tamanho (bytes) | SHA-256 | `fc /b` |
|---|---|---|---:|---|---|
| 1 | `PROJECT_STATE.md` | `docs/legacy/pre-model/PROJECT_STATE_FULL_SNAPSHOT.md` | 471.705 | `7cacddd59c5b2fe9bae1add1a54a3433c370ccdad713bbd4010a1d11f1b39a98` | **nenhuma diferença encontrada** (exit code 0) |
| 2 | `AGENT_HANDOFF.md` | `docs/legacy/pre-model/AGENT_HANDOFF_FULL_SNAPSHOT.md` | 27.329 | `386810890675714527fc349fa29ddab3fe977dd80c0b270899a7b1a2b3a24b4d` | **nenhuma diferença encontrada** (exit code 0) |
| 3 | `services/documents-ingestor/PROJECT_STATE.md` | `docs/legacy/pre-model/DOCUMENTS_INGESTOR_PROJECT_STATE_FULL_SNAPSHOT.md` | 64.580 | `331d0ca977bf8cc96c021dace5db9afbb77c06a8f3ecc1879df460f25f4054eb` | **nenhuma diferença encontrada** (exit code 0) |

**Soma de tamanhos:** 471.705 + 27.329 + 64.580 = **563.614 bytes** (3 cópias).
**Soma de SHA-256:** `7cac…` ≠ `3868…` ≠ `331d…` — **os três snapshots têm hashes diferentes** (conteúdo byte-diferente), confirmando que `Copy-Item -LiteralPath` preservou o conteúdo bruto de cada origem sem coalescência.

## 2. Conteúdo de cada snapshot (integral, byte-a-byte)

Cada snapshot contém **o arquivo de origem completo**, incluindo:
- bloco ativo (quando aplicável);
- delimitador `# HISTÓRICO LEGADO PRÉ-MODELO — CONGELADO` (ou equivalente: `# HISTÓRICO DE HANDOFFS — CONGELADO`, `# REGISTROS HISTÓRICOS DO COMPONENTE — CONGELADOS`);
- notas de congelamento (5 linhas após o delimitador);
- separador `---`;
- todo o histórico congelado (`# HISTÓRICO LEGADO PRÉ-MODELO — CONGELADO` e seções subsequentes);
- encoding original (UTF-8 com ou sem BOM, conforme a origem);
- finais de linha originais (CRLF ou LF, conforme a origem);
- newline final (se a origem termina com newline).

**Nenhum cabeçalho, rodapé, comentário ou metadado foi adicionado dentro dos três snapshots.** O snapshot é literalmente o arquivo de origem.

## 3. Declarações obrigatórias

Os snapshots acima:

1. **NÃO são fontes de estado atual.** O estado operacional permanece nos blocos ativos dos arquivos originais: `PROJECT_STATE.md` (raiz), `AGENT_HANDOFF.md` (raiz) e `services/documents-ingestor/PROJECT_STATE.md`.
2. **NÃO devem receber novos closeouts.** Nenhuma nova fase deve acrescentar conteúdo a estes snapshots.
3. **NÃO devem ser editados.** A imutabilidade é a propriedade fundamental: qualquer edição invalidaria a paridade byte-a-byte com a origem e quebraria a auditabilidade da preservação.
4. **Existem somente para preservação e auditoria.** São evidências imutáveis de que o conteúdo documental pré-compactação foi integralmente preservado antes de qualquer migração para ledger ou remoção de histórico.
5. **O estado operacional permanece nos blocos ativos dos arquivos originais.** `PROJECT_STATE.md` ativo (raiz, linhas 1-36) declara `Última fase aceita: G28-DOCS-B2 — CLOSED / ACCEPTED`; `AGENT_HANDOFF.md` ativo (raiz, linhas 1-40) declara `Estado de entrada: G28-DOCS-B2 — CLOSED / ACCEPTED`; `services/documents-ingestor/PROJECT_STATE.md` ativo (linhas 1-72) declara contexto técnico estável.
6. **O ledger de refactor existente (`docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`) NÃO foi copiado.** Ele permanece como fonte existente e será referenciado (não duplicado) por futuros ledgers.

## 4. Compatibilidade com o contrato de governança documental

Esta fase (`G28-DOCS-B3-B0`) é estritamente aditiva:
- Não cria ledger novo.
- Não cria arquivo de preservação com cabeçalho próprio (apenas cópias integrais).
- Não classifica blocos em L/V/P/D/G.
- Não remove ou move nenhum conteúdo dos arquivos originais.
- Não escreve código, não executa testes, não aplica migration, não acessa Supabase real, não faz push.

A paridade byte-a-byte foi verificada por dois métodos independentes:
- `Get-FileHash -Algorithm SHA256` produzindo hashes idênticos para cada par origem × cópia.
- `fc /b` (Windows file compare, modo binário) produzindo "nenhuma diferença encontrada" e exit code 0 para cada par.

## 5. Estado Git esperado após commit

- **Arquivos novos:** exatamente 4 (3 snapshots + este MANIFEST).
- **Arquivos alterados:** nenhum.
- **Working tree após staging:** limpo; staging contém exatamente os 4 arquivos novos.
- **Commit esperado:** `Preserve pre-model documentation snapshots`.
- **Push:** não realizado.
- **`G28-B3-B5-C` permanece suspensa** (registrada em `PROJECT_STATE.md` ativo, linha 21).
