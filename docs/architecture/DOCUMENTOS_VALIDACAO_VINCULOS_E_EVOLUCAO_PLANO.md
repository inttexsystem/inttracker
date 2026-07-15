# G28-P0 — CLOSEOUT MECÂNICO (REGISTRO HISTÓRICO)

- **Status:** `CLOSED / ACCEPTED` (histórico).
- **HEAD de fechamento:** `383db586e70852fba3c5ae5d5ac5312ab1b49284`.
- **G28-A:** `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT`.
- **G28-B1:** `AUTHORIZED` no instante deste closeout; desde então G28-B1, B2, B3, B4 e B5-D5 foram aceitos.
- **Estado atual:** ver CURRENT EXECUTION CHECKPOINT acima e `PROJECT_STATE.md`.
- **Registro histórico apenas:** a fase ativa, o último bloco aceito e a próxima ação autorizável estão no checkpoint e em `PROJECT_STATE.md`.

---

# PLANO MESTRE — DOCUMENTOS, VALIDAÇÃO HUMANA, VÍNCULOS E EVOLUÇÃO

**Projeto:** Ravatex — Controle de Tapetes / Documents Ingestor  
**Status do plano:** reconciliado (G28-PLAN-R1 em 2026-07-14); este plano é o backlog arquitetural do G28 e `PROJECT_STATE.md` detém o estado operacional atual.
**Fase ativa:** G28-D está autorizado exclusivamente para `RELEASE CONTRACT DISCOVERY AND RELEASE-CANDIDATE PREPARATION`; G28-C permanece `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`.
**Última fase aceita:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`.
**G28-D:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`; falta mapeamento canônico atual de publicação e procedimento autorizado de migrations de produção. Sem publicação, push, produção ou aceite; ver `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
**G28-B6:** `DECIDED / IMPLEMENTED / TESTED / STAGING FUNCTIONALLY VERIFIED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT` — commit técnico `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`; closeout de verificação em staging `b130db44d32718ddf6d3e2bffb1439dac3a1948f`; `db/51` aplicado em `ucrjtfswnfdlxwtmxnoo`; matriz RPC 20/20, prova de dupla propriedade e rollback PostgreSQL do wrapper. Contrato: Documento→Pedido 0..1, Documento→OP 0..N; revisão dedicada, tipada/versionada; campos do Ingestor não promovidos. Débitos não bloqueantes aceitos: smoke autenticado de browser pendente; duas expectativas obsoletas em `tests/documentos-recebidos-queue-ui.test.js`; grafo sintético de auditoria em staging preservado sob `ON DELETE RESTRICT`. Ver ledger G28 (closeout B6 e aceite).
**G28-B7:** `IMPLEMENTED / TESTED (local)` — read model canônico de projeção reversa (`js/document-surface-links-read-model.js`) + seção `DOCUMENTOS VINCULADOS` no detalhe do Pedido, confirmados via revisão canônica ativa e distintos de sugestões `pedido_manual`. Commit parcial Pedido-detail B7: `ed35f049397af4061ed6e8bb2d9ec3056c543724`. Continuação same-phase completou as superfícies restantes: detalhe da OP (`op-latex-admin` + `op-tecelagem-producao-admin`), timeline canônica de Pedido/OP, busca global canônica na fila central, helper UI compartilhado `js/document-links-surface-ui.js`. Verificação de render autenticado pendente em staging. Ver ledger G28 (B7).
**G28-B8:** `STAGING FUNCTIONALLY VERIFIED / READY FOR ARCHITECT ACCEPTANCE` — `db/52` aplicada uma vez em `ucrjtfswnfdlxwtmxnoo` (registry `20260715024449`), estrutura/RPC/grants verificados e matriz sintética autenticada 18/18 aprovada, inclusive wrapper B6 de cinco argumentos e fronteira de propriedade. O smoke autenticado do modal permanece `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`; ver ledger G28 (B8).
**G28-C:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`; matriz staging/projeções `16/16 PASS`; browser autenticado permanece dívida de tooling. **G28-D:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`; não aceito e não publicado.
**Decisões de arquiteto em aberto:** `OPEN_ARCHITECT_DECISIONS: DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`.
**Última reconciliação:** 2026-07-14 (G28-PLAN-R1; checkpoint B6 atualizado após verificação direta).
**Regras de autoridade:** Git comprova branch/HEAD/index/worktree vivos; `PROJECT_STATE.md` detém estado operacional atual; `AGENT_HANDOFF.md` detém continuidade; G28 ledger detém histórico append-only de closeouts; este plano mestre detém arquitetura/backlog; planos sozinhos não autorizam execução.

---

## HISTORICAL EXECUTION CHECKPOINT — SUPERSEDED

> **Este checkpoint foi superado.** O estado canônico posterior está registrado no cabeçalho deste plano (linhas 1–25) e em `PROJECT_STATE.md`. G28-C é `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`; G28-D discovery está `COMPLETED / BLOCKED_BY_MISSING_DEPLOYMENT_DEFINITION`; G28-B8 foi subsumido pela aceitação de G28-C. Nenhuma fase funcional está ativa. Consulte o cabeçalho e `PROJECT_STATE.md` para o estado atual.

**Data:** 2026-07-14 (HISTÓRICO)
**Baseline técnico:** `9ef61e1896af631bc5aeeced4af93c77051f4de4` (branch `work/g28-document-qualification`; worktree limpo antes da implementação B8).

**Última fase aceita neste checkpoint:** `G28-B7 — exibição nas superfícies — CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` (aceite arquitetural explícito em 2026-07-14; parcial `ed35f04`, conclusão `9ef61e1`).

**Fase ativa neste checkpoint:** `G28-B8 — correção, revogação, restauração e auditoria — IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`.

**Incremento G28-B8:** `db/52` aplicada uma vez em `ucrjtfswnfdlxwtmxnoo` (registry `20260715024449`), sem backfill/alteração B5. Estrutura/RPC/grants e matriz `G28-B8-VERIFY` 18/18 verificadas diretamente; a fronteira candidate/event/decision permaneceu intacta e as fixtures foram limpas. O único débito é `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`.

**Evidência de staging (B6/B8):** projeto `ucrjtfswnfdlxwtmxnoo`, sem acesso a produção; migration 51 preservada e `db/52` aplicada/verificada. B8: matriz funcional RPC 18/18, sem mutar campos Ingestor/decisão, sem efeitos operacionais e cleanup de fixtures zero. B6: wrapper atômico passou no caminho interno de cinco argumentos após a evolução da assinatura.

**Decisões de arquiteto em aberto neste checkpoint:** `OPEN_ARCHITECT_DECISIONS: NONE`.

**Limite verificado:** os testes locais cobrem os contratos B6/B7/B8; a aplicação e a verificação de `db/52` em staging, e o smoke autenticado do modal de administração, são exigidos e não autorizam produção, backfill ou reparo histórico.

**Regras de autoridade neste checkpoint:**
- Git comprova branch/HEAD/index/worktree vivos;
- `PROJECT_STATE.md` detém o estado operacional atual;
- `AGENT_HANDOFF.md` detém a continuidade;
- O ledger G28 detém o histórico append-only de closeouts;
- Este plano mestre detém arquitetura e backlog;
- Planos sozinhos não autorizam execução.

---

## 1. OBJETIVO

Organizar a evolução da frente de Documentos sem quebrar a arquitetura já consolidada, preservando:

- fontes de verdade reais;
- separação entre detecção técnica, validação humana, vínculo operacional e decisão administrativa;
- integração canônica com Pedido e OP;
- continuidade visual do app;
- operação completa mesmo sem participação ativa de fornecedores;
- sequência de implementação auditável;
- backlog futuro de acesso, backup e colaboração externa.

Este plano deve ser lido em conjunto com:

- `PROJECT_STATE.md`;
- `AGENT_HANDOFF.md`;
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`;
- documentos de arquitetura referenciados por esses arquivos;
- contrato visual versionado, quando criado;
- skills e instruções relevantes existentes em `.claude/`.

---

# CAMADA 0 — GOVERNANÇA OBRIGATÓRIA

## 0.1 Fontes canônicas

Antes de qualquer diagnóstico, implementação, migration, UI ou integração, a IAsup deve ler:

1. `PROJECT_STATE.md`;
2. `AGENT_HANDOFF.md`;
3. `services/documents-ingestor/PROJECT_STATE.md`;
4. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`;
5. este plano;
6. demais documentos de arquitetura diretamente referenciados;
7. instruções e skills visuais aplicáveis em `.claude/`.

Nenhuma ordem deve depender apenas de memória de conversa ou relatório anterior.

## 0.2 Invariantes estruturais

### Entidades e CNPJ

- `clientes.cnpj` é a fonte direta de CNPJ de Cliente.
- `fornecedores.cnpj` é a fonte direta de CNPJ de Fornecedor.
- Cliente e Fornecedor permanecem independentes.
- O mesmo CNPJ pode existir legitimamente nas duas categorias.
- É proibido reintroduzir:
  - `parceiros`;
  - `parceiro_id`;
  - `parceiro_cnpjs`;
  - entidade empresarial genérica obrigatória;
  - dupla escrita;
  - fallback silencioso;
  - sincronização paralela;
  - fonte de verdade concorrente;
  - camada temporária que esconda arquitetura incorreta.

### Pedido, OP e documentos

- Pedido e OP são entidades operacionais reais.
- Documento deve se vincular diretamente às entidades canônicas aplicáveis.
- Nenhuma abstração de UI pode esconder entidade intermediária desnecessária.
- Nenhum vínculo genérico opaco deve substituir relações reais sem justificativa arquitetural aprovada.

### Separação de conceitos

Devem permanecer separados:

1. detecção técnica;
2. classificação sugerida;
3. evidência técnica;
4. validação humana;
5. vínculo com Pedido/OP;
6. estado operacional;
7. decisão administrativa;
8. duplicidade;
9. origem e autoria;
10. histórico e versão.

Uma decisão humana não pode apagar a evidência técnica original.

## 0.3 Regra estrutural de NF-e

A análise deve ser orientada pela direção e pela contraparte relevante.

### NF de entrada

- emitente = Fornecedor esperado;
- destinatário = CNPJ próprio da Ravatex.

### NF de saída

- emitente = CNPJ próprio da Ravatex;
- destinatário = Cliente esperado.

Não exigir match de Cliente/Fornecedor nos dois lados da nota.

## 0.4 Gate visual

Antes de alterar UI, modal, lista, tabela, card, navegação ou interação, a IAsup e a IAexec devem consultar:

- `.claude/`;
- skills visuais aplicáveis;
- instruções de UI;
- componentes existentes;
- padrões de modal, formulário, tabela e navegação;
- telas reais de Pedido e OP;
- referências de aceite visual.

Preservar:

- linguagem visual já consolidada;
- cantos com pouca curvatura;
- ausência de pílulas e sombras pesadas sem necessidade;
- terminologia PT-BR já aprovada;
- consistência entre Documentos, Pedido e OP;
- componentes e fluxos canônicos;
- responsividade e acessibilidade;
- proibição de réplicas simplificadas que não atendam ao requisito real.

## 0.5 Papel da pasta `.claude`

A pasta `.claude` deve ser inventariada antes da primeira implementação visual relevante.

Separar:

- skills operacionais;
- instruções visuais permanentes;
- configurações locais;
- exemplos e referências;
- arquivos específicos de máquina;
- conteúdo que precisa ser promovido para documentação versionada.

Regra:

- `.claude/skills` pode ensinar agentes a aplicar padrões;
- regras permanentes de produto e UI não podem existir somente em `.claude`;
- deve ser criado ou consolidado um contrato visual versionado, preferencialmente:
  - `docs/architecture/UI_VISUAL_CONTRACT.md`.

## 0.6 Gate obrigatório de conformidade

Todo relatório técnico deve incluir:

### STRUCTURAL POLICY COMPLIANCE

- arquivos canônicos lidos;
- invariantes aplicáveis;
- como foram preservadas;
- propostas rejeitadas;
- conflitos encontrados;
- decisões reservadas ao arquiteto.

Toda fase de UI deve incluir também:

### VISUAL POLICY COMPLIANCE

- arquivos e skills consultados;
- padrões reutilizados;
- desvios visuais;
- evidência de aderência;
- validação visual necessária.

Sem essas seções, a fase não pode ser aceita.

---

# CAMADA 1 — DOCUMENTOS

Esta é a frente ativa e prioritária.

## 1.1 Objetivo da primeira entrega operacional

Habilitar a seção de Documentos para que o sistema:

1. detecte arquivos candidatos;
2. apresente a sugestão técnica;
3. permita validação humana;
4. vincule corretamente a Pedido e OP;
5. mostre o documento nas superfícies corretas;
6. preserve histórico, autoria e evidência;
7. funcione de ponta a ponta em staging;
8. seja publicado para o cliente acompanhar.

Não haverá autoaceite nesta primeira versão.

---

## 1.2 Fluxo alvo

```text
Entrada do documento
→ detecção técnica
→ fila de validação
→ modal “Validar e vincular”
→ vínculos canônicos
→ exibição em Documentos / Pedido / OP
→ correção e auditoria
→ validação em staging
→ publicação para o cliente acompanhar
```

### Origens previstas

- Gmail;
- upload manual interno;
- futuramente upload do fornecedor;
- futuramente integrações externas.

Toda entrada deve registrar origem e autoria.

---

## 1.3 Detecção técnica

Registrar, quando aplicável:

- formato;
- assinatura do arquivo;
- tipo provável;
- estrutura NF-e;
- CNPJ de emitente e destinatário;
- validade de cada CNPJ;
- direção provável;
- contraparte provável;
- possíveis matches de Cliente/Fornecedor;
- conflito MIME/extensão;
- duplicidade;
- razões técnicas da sugestão.

A detecção é uma hipótese técnica, não uma decisão administrativa.

---

## 1.4 Fila de validação humana

A seção central de Documentos deve permitir:

- listar candidatos;
- filtrar pendentes;
- abrir o arquivo;
- visualizar evidência;
- visualizar alertas;
- identificar duplicidade;
- abrir validação;
- consultar vínculos;
- consultar histórico.

Estados visuais esperados, sem fechar ainda o schema:

- aguardando validação;
- validado;
- rejeitado;
- ignorado;
- validação revogada;
- duplicidade detectada;
- conflito técnico;
- registry indisponível;
- documento desconhecido.

---

## 1.5 Modal “Validar e vincular”

A ação principal recomendada é:

```text
Validar e vincular
```

O modal deve exibir:

### Evidência técnica

- nome do arquivo;
- origem;
- remetente;
- data;
- formato;
- tipo sugerido;
- direção sugerida;
- CNPJs;
- Cliente/Fornecedor possíveis;
- motivos da sugestão;
- avisos;
- preview ou acesso ao arquivo.

### Campos humanos

- tipo real;
- subtipo, quando aplicável;
- direção;
- Cliente ou Fornecedor;
- número/chave/data, quando aplicável;
- Pedido;
- OP ou OPs;
- observação;
- motivo de rejeição ou ignorar.

Os campos devem aparecer conforme o tipo selecionado.

### Ações

- validar e vincular;
- rejeitar;
- ignorar;
- cancelar;
- futuramente corrigir ou revogar.

---

## 1.6 Regras por tipo

### NF-e XML

Confirmar:

- entrada ou saída;
- emitente;
- destinatário;
- contraparte esperada;
- Pedido;
- OPs;
- número/chave/data, quando extraíveis.

### NF em PDF

- tipo apenas provável;
- confirmação humana obrigatória;
- nunca autoaceitar;
- contraparte e vínculos confirmados manualmente.

### Romaneio

Confirmar:

- Fornecedor;
- Pedido;
- OP;
- etapa ou movimento relacionado;
- data;
- observação.

### Documento desconhecido

Permitir:

- escolher tipo;
- classificar manualmente;
- vincular;
- rejeitar;
- ignorar com justificativa.

### Duplicidade

Mostrar:

- documento canônico;
- ocorrência anterior;
- vínculos existentes;
- opção de manter nova ocorrência;
- opção de reutilizar vínculos;
- opção de tratar como diferente com justificativa.

---

## 1.7 Efeitos proibidos no modal

Validar documento não deve automaticamente:

- receber material;
- concluir transferência;
- aceitar OP;
- alterar status de produção;
- movimentar estoque;
- concluir Pedido;
- gerar financeiro;
- substituir documento anterior.

Essas ações devem permanecer explícitas e separadas.

---

## 1.8 Vínculos canônicos

Primeiro escopo:

```text
Documento ↔ Pedido
Documento ↔ OP
```

Futuro, somente quando o processo exigir:

```text
Documento ↔ recebimento
Documento ↔ transferência
Documento ↔ expedição
Documento ↔ ordem de compra
```

Evitar relação genérica opaca `target_type/target_id` como atalho arquitetural.

---

## 1.9 Superfícies de exibição

Depois de validado, o documento deve aparecer em:

- tela central de Documentos;
- detalhe do Pedido;
- detalhe da OP;
- timeline/histórico aplicável;
- buscas e filtros;
- futuramente área do fornecedor.

Todas as telas devem consumir o mesmo vínculo canônico.

---

## 1.10 Correção, revogação e auditoria

Permitir:

- corrigir tipo;
- trocar contraparte;
- trocar Pedido;
- adicionar/remover OP;
- rejeitar;
- ignorar;
- revogar validação;
- restaurar;
- consultar versões;
- identificar ator e timestamp.

Nunca sobrescrever histórico silenciosamente.

---

# SEQUÊNCIA DE IMPLEMENTAÇÃO — DOCUMENTOS

## G28-P0 — Consolidação do plano e gates

Objetivo:

- aprovar este plano;
- inventariar `.claude`;
- consolidar contrato estrutural;
- consolidar contrato visual;
- registrar fontes canônicas;
- corrigir o diagnóstico G28-A.

Sem código, migration ou UI.

## G28-B1 — Contrato de domínio documental

Definir os tipos puros e o contrato de domínio para:

- evidência técnica;
- sugestão;
- direção e contraparte;
- revisão humana;
- decisão canônica;
- duplicidade;
- vínculos;
- cardinalidades;
- correção/revogação;
- compatibilidade com estruturas existentes.

### Mapeamento obrigatório antes de qualquer persistência nova

A separação dos eixos de domínio (detecção, evidência, revisão, vínculo, decisão)
**não obriga tabelas independentes**. Antes de propor persistência nova, G28-B1
deve mapear:

- `document_decisions` existente;
- `documentos_operacionais` existente;
- estados atuais;
- possibilidade de ampliar a fonte canônica atual;
- risco de dupla escrita;
- risco de decisões humanas concorrentes.

**É proibido criar fonte paralela para validação humana se a decisão canônica
existente puder representar o fluxo corretamente.**

### Decisões abertas de G28-B1 (não decididas nesta correção documental)

- cardinalidade Documento ↔ OP;
- um documento pode ou não vincular múltiplas OPs;
- como `documentos_operacionais` representa isso;
- quais tipos exigem Pedido;
- quais tipos exigem OP;
- quais vínculos são opcionais;
- como tratar vínculo incompatível com o tipo.

Sem persistência, sem runtime e sem UI nesta fase.

## G28-B2 — Persistência local da evidência e histórico técnico

Persistir localmente (ex.: SQLite) a evidência técnica e o histórico técnico, sem
inventar dados legados e sem antecipar a decisão humana:

- evidência técnica;
- razões;
- origem;
- autoria;
- versão;
- relação de duplicidade;
- histórico técnico.

## G28-B3 — Eventos, exportação, Supabase e reader

Propagar:

```text
persistência local
→ eventos/outbox
→ JSONL
→ exportPackage
→ writer
→ Supabase
→ reader do Controle
```

Migration somente aditiva e validada primeiro em staging.

## G28-B4 — Fila / read model de revisão documental

Implementar o read model e a fila de revisão:

- listagem;
- filtros;
- alertas;
- acesso ao arquivo;
- indicação de vínculos;
- indicação de duplicidade;
- indicação de que há ação de validação disponível.

Sem persistir decisão humana nesta fase.

## G28-B5 — Persistência da decisão humana e dos vínculos canônicos

Persistir a **decisão humana** e os **vínculos canônicos com Pedido/OP**,
reutilizando a fonte canônica existente sempre que ela representar o fluxo
corretamente (ver o mapeamento obrigatório de G28-B1). Sem UI funcional nesta fase.

## G28-B6 — Modal funcional "Validar e vincular"

Implementar o modal dinâmico e os contratos de ação **consumindo o backend real**
de decisão e de vínculos.

**O modal funcional não pode anteceder a persistência da decisão e dos vínculos
(G28-B5).**

## G28-B7 — Exibição nas superfícies

Exibir em:

- Documentos;
- Pedido;
- OP;
- timeline;
- buscas.

## G28-B8 — Correção, revogação, restauração e auditoria

Implementar:

- reclassificação;
- alteração de vínculos;
- revogação;
- restauração;
- histórico;
- autoria.

## G28-C — Validação real em staging

Cenários mínimos:

- NF entrada;
- NF saída;
- XML;
- PDF;
- romaneio;
- desconhecido;
- duplicidade;
- conflito MIME/extensão;
- CNPJ inválido;
- registry indisponível;
- Cliente/Fornecedor não encontrado;
- Pedido;
- OP;
- correção;
- revogação.

## G28-D — Publicação para o cliente acompanhar

Critérios:

- identificação funcional;
- validação humana;
- vínculos corretos;
- exibição nas telas;
- correção e auditoria;
- staging validado;
- CI verde;
- nenhum efeito operacional implícito.

Marco:

```text
DOCUMENTOS — CLIENT OBSERVATION RELEASE
```

Depois da publicação:

- observar uso real;
- corrigir fricções;
- medir falsos positivos;
- ajustar modal;
- validar onde os usuários procuram documentos.

---

# CAMADA 2 — ADMINISTRAÇÃO DE USUÁRIOS E ACESSOS

Frente futura, deferida até Documentos estabilizar.

## Objetivos

- listar usuários;
- criar ou convidar;
- definir perfil;
- definir permissões;
- habilitar/bloquear acesso;
- resetar senha;
- exigir troca de senha;
- consultar último acesso;
- revogar sessões, se suportado;
- auditar alterações;
- futuramente vincular usuário externo diretamente a Fornecedor.

## Política de senha

Evitar senha padrão compartilhada.

Preferir:

- senha temporária com troca obrigatória; ou
- convite para definição da primeira senha.

A senha temporária deve:

- expirar;
- ser de uso único;
- não ser recuperável;
- não ser reutilizada entre usuários.

## Sequência futura

```text
A1 — diagnóstico da autenticação
A2 — papéis e permissões
A3 — administração de usuários
A4 — convite/senha inicial
A5 — reset, bloqueio e reativação
A6 — auditoria
A7 — preparação para usuários externos
```

---

# CAMADA 3 — BACKUP EM NUVEM

Frente futura e independente.

Existe outro app com infraestrutura e frontend reaproveitáveis, mas a adaptação exige auditoria porque o app de origem usa SQLite e esta aplicação possui outra arquitetura de persistência.

## Diagnóstico obrigatório

Mapear:

- o que é copiado;
- origem dos dados;
- destino;
- criptografia;
- retenção;
- versionamento;
- agendamento;
- logs;
- checksums;
- restauração;
- tratamento de falha;
- permissões.

## Seção de backup

Exibir:

- último backup;
- próximo backup;
- tamanho;
- destino;
- retenção;
- histórico;
- falhas;
- backup manual;
- integridade;
- restauração controlada.

## Regra

Backup sem restauração testada não é considerado confiável.

Fluxo mínimo:

```text
backup
→ armazenamento
→ checksum
→ retenção
→ teste de restauração
→ auditoria
```

## Sequência futura

```text
BK1 — auditoria do app existente
BK2 — mapeamento para Ravatex
BK3 — contrato de backup
BK4 — backend
BK5 — adaptação do frontend
BK6 — retenção e histórico
BK7 — restauração controlada
BK8 — teste real de recuperação
```

---

# CAMADA 4 — PARTICIPAÇÃO FUTURA DE FORNECEDORES

A aplicação interna deve continuar funcional sem participação ativa do fornecedor.

## Princípio

Usuário externo deve se vincular diretamente a `fornecedor_id`.

Não criar parceiro genérico.

## Evolução

### F0 — preparação estrutural

Prever:

- origem;
- autoria;
- fornecedor direto;
- permissões futuras;
- histórico de submissão.

### F1 — portal somente leitura

Fornecedor pode:

- ver suas OPs;
- ver documentos autorizados;
- ver pendências;
- acompanhar transferências/recebimentos aplicáveis;
- baixar documentos permitidos.

### F2 — upload de documentos

Fornecedor pode enviar:

- NF;
- romaneio;
- comprovante;
- laudo;
- outros tipos autorizados.

Todo upload entra na mesma fila humana.

### F3 — respostas e correções

Fornecedor pode:

- responder pendência;
- substituir arquivo;
- corrigir metadados;
- receber rejeição;
- reenviar.

### F4 — participação operacional controlada

Futuramente:

- informar envio;
- confirmar expedição;
- propor transferência;
- informar quantidade;
- informar previsão;
- anexar documento de movimento.

Inicialmente, toda ação crítica exige aceite interno.

### F5 — colaboração ampliada

- notificações;
- comentários;
- SLA;
- divergências;
- aceite bilateral;
- histórico de comunicação;
- API.

---

# BACKLOG PRIORIZADO

## P0 — obrigatório antes de nova implementação

- [ ] Aprovar este plano.
- [ ] Corrigir formalmente a arquitetura proposta em G28-A.
- [ ] Inventariar `.claude`.
- [ ] Criar/consolidar contrato visual versionado.
- [ ] Tornar gates estrutural e visual obrigatórios.
- [ ] Confirmar regra de NF por direção e contraparte.
- [ ] Separar qualificação, revisão, duplicidade, vínculo e decisão.

## P1 — documentos, entrega principal

- [ ] Contrato de domínio.
- [ ] Persistência local.
- [ ] Histórico.
- [ ] Eventos/export.
- [ ] Supabase.
- [ ] Reader.
- [ ] Fila de Documentos.
- [ ] Modal Validar e vincular.
- [ ] Vínculos Pedido/OP.
- [ ] Exibição nas superfícies.
- [ ] Correção/revogação.
- [ ] Staging real.
- [ ] Publicação para cliente acompanhar.

## P2 — estabilização pós-publicação

- [ ] Observar uso real.
- [ ] Ajustar falsos positivos.
- [ ] Ajustar UX.
- [ ] Melhorar filtros.
- [ ] Melhorar histórico.
- [ ] Tratar documentos legados.
- [ ] Refinar duplicidade.

## P3 — administração

- [ ] Usuários.
- [ ] Papéis.
- [ ] Permissões.
- [ ] Senha inicial.
- [ ] Reset.
- [ ] Bloqueio.
- [ ] Auditoria.

## P4 — backup

- [ ] Auditar app existente.
- [ ] Adaptar backend.
- [ ] Adaptar frontend.
- [ ] Agendamento.
- [ ] Retenção.
- [ ] Integridade.
- [ ] Restauração testada.

## P5 — fornecedor

- [ ] Portal read-only.
- [ ] OPs.
- [ ] Documentos.
- [ ] Pendências.
- [ ] Upload.
- [ ] Correções.
- [ ] Transferências.
- [ ] Participação operacional controlada.

---

# ITENS EXPLICITAMENTE DIFERIDOS

- autoaceite de documentos;
- movimentação automática por documento;
- portal do fornecedor;
- upload externo;
- alteração operacional direta por fornecedor;
- administração completa de usuários;
- backup em nuvem;
- restauração;
- correção dos oito erros TypeScript históricos;
- vulnerabilidades npm;
- limpeza de worktrees;
- metadata órfã;
- acumulação remota de manifest.

Esses itens devem ter fases próprias.

---

# HARD STOPS

Parar e retornar ao arquiteto se:

- proposta contrariar fonte canônica;
- surgir entidade intermediária;
- houver dupla escrita ou fallback;
- for necessário misturar validação com movimentação;
- UI esconder arquitetura incorreta;
- migration preceder contrato aprovado;
- fornecedor virar dependência do fluxo interno;
- autoaceite for introduzido;
- acesso, backup ou portal contaminarem a cadeia documental ativa;
- `.claude` ou contrato visual não forem consultados em fase de UI;
- houver conflito entre documentos canônicos.

---

# ACOMPANHAMENTO PERMANENTE E MATRIZ DE FASES

> **Registro documental IAexec — fase `G28-P0`.** Esta seção foi acrescentada
> durante o registro de governança (`G28-P0`). Não substitui nenhuma decisão do
> IAlead: apenas materializa o rastreamento permanente e a governança de
> atualização exigidos para acompanhar as fases. O conteúdo arquitetural
> original acima permanece inalterado.

## Estados permitidos

`PLANNED` · `DIAGNOSED` · `DECIDED` · `IMPLEMENTED` · `TESTED` · `ACCEPTED` ·
`DEFERRED` · `AUTHORIZED` · `IN_PROGRESS` · `HOLD` · `TECHNICALLY_ACCEPTED` ·
`PUBLISHED` · `BLOCKED` · `REJECTED` · `CLOSED` · `SUPERSEDED` · `NOT_STARTED`.

Fases aceitas devem exibir explicitamente os rótulos separados que aplicam
(`DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED`), não apenas `CLOSED`.
Fases planejadas não iniciadas devem exibir `PLANNED / NOT DIAGNOSED / NOT DECIDED
/ NOT IMPLEMENTED / NOT ACCEPTED` quando relevante, não um simples `PLANNED`.
Qualificadores compostos podem detalhar um estado base — por exemplo
`REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` e `PLANNED / NOT AUTHORIZED`.

## Matriz de fases

| ID | Fase | Status dimension labels | Dependências | Branch / workspace | Commit / HEAD | Evidência | Próximo passo |
|---|---|---|---|---|---|---|---|
| G28-P0 | Consolidação do plano, mapa de ativos e gates | `PLANNED / IMPLEMENTED / ACCEPTED` | G27 CLOSED/publicado | `work/g28-document-qualification` @ `controle-tapetes-g28` | Conforme ledger G28 | Fase documental concluída; G28-P0-R1 reconciliado | — |
| G28-A | Diagnóstico de schema/domínio documental | `PLANNED / DIAGNOSED / REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` | G28-P0 | — | — | Schema, `db/49`, `qualified`, `duplicate` não aprovados; evidências aproveitáveis | Insumo diagnóstico para G28-B1 |
| G28-B1 | Contrato de domínio documental | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-P0 | `work/g28-document-qualification` @ `controle-tapetes-g28` | `c65fa41` | Contrato puro de domínio para evidência, sugestão, revisão e decisão humana; testes 187/187 | — |
| G28-B2 | Persistência local da evidência e histórico técnico | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-B1 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Conforme ledger G28 | Evidência técnica persistida localmente; histórico versionado; testes finais 299/299 | — |
| G28-B3 | Eventos, exportação, Supabase e reader | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` (subfases aceitas; ver subfases abaixo) | G28-B2 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Conforme ledger G28 | B3-B1 a B3-B4, B3-B5-A, B3-B5-B, B3-B5-C, B3-B6-B aceitos; migration 49 aplicada e verificada em staging | — |
| G28-B4 | Fila / read model de revisão documental | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-B3 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Conforme ledger G28 | Subfases B4-A a B4-B4 aceitas; queue read model, filtros, indicadores de estado e acesso a arquivos implementados | — |
| G28-B5 | Persistência da decisão humana e dos vínculos canônicos Pedido/OP | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` (B5-D5 consolidated: B1–B5) | G28-B4 | `work/g28-document-qualification` @ `controle-tapetes-g28` | `7d3e0261b668a46a80208198352039dc1f352010` | Decisão-comando canônica, boundary de source explícito, remoção de statusOverrides e legacy RPC runtime aceitos; linking canônico não implementado | — |
| G28-B6 | Vínculos canônicos Documento↔Pedido/OP + modal "Validar e vincular" | `DECIDED / IMPLEMENTED / TESTED / STAGING FUNCTIONALLY VERIFIED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT` | G28-B5 | `work/g28-document-qualification` @ `controle-tapetes-g28` | técnico `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`; closeout staging `b130db44d32718ddf6d3e2bffb1439dac3a1948f` | staging `ucrjtfswnfdlxwtmxnoo`: matriz RPC 20/20, dupla propriedade e rollback do wrapper provados; modal autenticado bloqueado por tooling; sem correção | Aceito 2026-07-14; G28-B7 autorizado |
| G28-B7 | Exibição nas superfícies (Documentos/Pedido/OP/timeline/buscas) | `CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` | G28-B6 | `work/g28-document-qualification` @ `controle-tapetes-g28` | parcial `ed35f049397af4061ed6e8bb2d9ec3056c543724`; conclusão `9ef61e1896af631bc5aeeced4af93c77051f4de4` | read model canônico + superfícies Pedido/OP/timeline/busca; débito não bloqueante: smoke autenticado B7 em staging | Aceito 2026-07-14; G28-B8 autorizado |
| G28-B8 | Correção, revogação, restauração e auditoria | `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C` | G28-B7 | `work/g28-document-qualification` @ `controle-tapetes-g28` | commit técnico `f985f8b857f83d977936eae47ea830a5cb6ba4c3` | `db/52` aplicada e verificada em staging (`ucrjtfswnfdlxwtmxnoo`, registry `20260715024449`); matriz RPC 18/18; bateria B4–B8 831/831. As capacidades de correção, revogação, restauração e auditoria foram explicitamente validadas e aceitas na matriz de staging/projeções de G28-C (16/16 PASS). B8 não está pendente; sua aceitação foi subsumida pelo gate e aceite arquitetural de G28-C. | — (subsumido por G28-C) |
| G28-C | Validação real em staging | `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` | G28-B8 | `work/g28-document-qualification` @ `controle-tapetes-g28` | closeout `a7d7caa8984e56b44c0302bff5d578a8be5ff536`; aceite `d5ec09f803c2c64697ee3605b7d4ecfee168a66a` | matriz staging/projeções 16/16 PASS; zero defeito material; sem alteração de produto, schema, RPC, migration ou arquitetura. Dívida não bloqueante: `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`. | — |
| G28-D | Publicação para o cliente acompanhar | `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION` (publicação: `NOT STARTED / NOT AUTHORIZED`) | G28-C | `work/g28-document-qualification` @ `controle-tapetes-g28` | release candidate `d5ec09f` (preparação `b27e79f`) | descoberta contratual concluída e registrada em `docs/releases/G28_D_RELEASE_CANDIDATE.md`. Bloqueio: falta mapeamento canônico de publicação e procedimento autorizado de migrations 51/52 em produção. Publicação, push, produção, tag e release não autorizados. | Definir contrato de publicação/produção (decisão de arquiteto) |
| CAMADA 2 (A1–A7) | Administração de usuários e acessos | DEFERRED | Documentos estabilizado | — | — | — | Só após Camada 1 publicada |
| CAMADA 3 (BK1–BK8) | Backup em nuvem e restauração testada | DEFERRED | Frente independente | — | — | — | Auditoria do app de origem |
| CAMADA 4 (F0–F5) | Participação futura de fornecedores | DEFERRED | Documentos publicado | — | — | — | Operação interna nunca depende do fornecedor |

### G28-B3 — Progresso das subfases

As subfases de G28-B3 que foram aceitas estão listadas abaixo. O bloco `G28-B3`
é considerado concluído em suas subfases aceitas; o status agregado está na
matriz acima.

| Subfase | Descrição | Estado | Commit(s) |
|---|---|---|---|
| G28-B3-B1 | Contrato de exportação da evidência técnica | `CLOSED / ACCEPTED` | `b794bb7` |
| G28-B3-B2 | Exportação da evidência corrente como JSONL | `CLOSED / ACCEPTED` | `812433d` |
| G28-B3-B3 | Schema remoto e RPC (`db/49_document_technical_evidences.sql`) | `CLOSED / ACCEPTED` | `7abafbb` |
| G28-B3-B4 | Writer service-role sobre a RPC, com hardening de classificação de erros | `CLOSED / ACCEPTED` | `abe49f1`; `96f2d4d` (R1) |
| G28-B3-B5-A | Diagnóstico de integração sync de evidência técnica | `CLOSED / ACCEPTED` — read-only | — |
| G28-B3-B5-B | Contrato de entrada JSONL e dry-run local | `CLOSED / ACCEPTED` | `013a0e1` |
| G28-B3-B5-C | Complete technical evidence sync integration | `CLOSED / ACCEPTED` | `3465405` |
| G28-B3-B6-B | Current technical evidence admin reader | `CLOSED / ACCEPTED` | `6ade74f` |

Migration 49: aplicada e verificada em staging `ucrjtfswnfdlxwtmxnoo` (conforme
ledger G28). Push: `NOT EXECUTED`. Produção `bhgifjrfagkzubpyqpew`: não acessada.
O reader (B3-B6-B) carrega evidência técnica corrente via RLS admin autenticado
direto, sem segundo client Supabase e sem writes.

## Governança de atualização (regra permanente)

- uma fase pode ser registrada como `AUTHORIZED`, `IN_PROGRESS`, `HOLD` ou
  `BLOCKED` durante a sua execução;
- decisões definitivas, evidências finais, HEADs aceitos e o fechamento só entram
  após o aceite técnico/arquitetural aplicável;
- a IAexec **não** declara o próprio trabalho `CLOSED`;
- `PROJECT_STATE.md` registra o estado atual (fase, HEAD, publicação, ambiente);
- este plano registra a sequência e as decisões;
- `AGENT_HANDOFF.md` registra a continuidade operacional.

Registrar o estado durante a execução não antecipa aceite: o fechamento
(`CLOSED`) e a publicação (`PUBLISHED`) dependem da revisão aplicável.

---

# CRITÉRIO DE FECHAMENTO DO PLANO

Este plano foi reconciliado em 2026-07-14 (G28-PLAN-R1). As decisões de arquiteto
em aberto (cardinalidade Documento↔Pedido, Documento↔OP, vínculos por tipo e
compatibilidade) permanecem listadas no CURRENT EXECUTION CHECKPOINT. O plano
será considerado totalmente fechado quando:

- arquiteto fechar as decisões em aberto;
- backlog estiver ordenado e reconciliado com o estado operacional;
- nenhum item futuro tiver sido confundido com escopo ativo;
- não houver contradição com `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`.

---

# PRÓXIMA AÇÃO — ESTADO ATUAL

**G28-P0-R1, G28-B1, G28-B2, G28-B3 (subfases aceitas), G28-B4, G28-B5-D5, G28-B6,
G28-B7, G28-B8 e G28-C foram aceitos** (G28-C em 2026-07-15, `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`;
closeout `a7d7caa`, aceite `d5ec09f`). G28-B8 está `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`:
suas capacidades de correção, revogação, restauração e auditoria foram explicitamente
validadas na matriz staging/projeções de G28-C (16/16 PASS) e aceitas no gate
arquitetural de C. **Nenhuma fase funcional está ativa.** A ação corrente é esta
reconciliação documental (`G28-STATE-RECONCILIATION-R1`). Após o fechamento desta
reconciliação, uma nova reconciliação read-only do backlog geral (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
e demais frentes) escolherá a próxima frente funcional. **Publicação não é a próxima
ação e nenhuma implementação automática se segue.** `OPEN_ARCHITECT_DECISIONS: DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`.

Fases aceitas: G28-P0, G28-A (rejeitado como contrato / retido como insumo diagnóstico), G28-B1, G28-B2,
G28-B3 (subfases aceitas), G28-B4, G28-B5-D5, G28-B6, G28-B7, G28-B8 (subsumido por C), G28-C.
G28-D discovery: `COMPLETED / BLOCKED_BY_MISSING_DEPLOYMENT_DEFINITION`. G28-D publicação: `NOT STARTED / NOT AUTHORIZED`.
Fases posteriores: `DEFERRED / NOT AUTHORIZED`.

Estado operacional atual: `PROJECT_STATE.md`.
Continuidade: `AGENT_HANDOFF.md`.
Histórico de closeouts: `docs/ledgers/G28_LEDGER.md`.
Arquitetura/backlog: este plano mestre.
