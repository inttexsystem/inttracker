# Ravatex Controle de Tapetes — Regras de Saúde Arquitetural

## 1. Princípio central

O app deve continuar simples, estático e modular.

A arquitetura atual aceita:

* `index.html` declarativo;
* scripts clássicos com `window.*`;
* módulos por tela ou domínio;
* smoke tests em Node;
* Supabase acessado pelo cliente quando apropriado;
* push de desenvolvimento apenas para `staging`.

A arquitetura não aceita:

* retorno de lógica pesada para `index.html`;
* criação de telas gigantes sem costura;
* writes Supabase espalhados em funções de render;
* refactor amplo misturado com feature;
* alteração de produção sem autorização explícita;
* remoção de cache-busting dos assets locais.

## 2. Regra para `index.html`

`index.html` deve permanecer declarativo.

Permitido:

* estrutura HTML base;
* carregamento de CSS/CDNs;
* carregamento ordenado dos scripts;
* container raiz do app;
* query string de cache-busting nos assets locais.

Proibido:

* lógica de negócio;
* funções de tela;
* funções de persistência;
* handlers complexos;
* Supabase reads/writes;
* scripts inline novos, salvo emergência justificada.

Qualquer novo script local em `index.html` deve usar o cache-busting vigente:

```html
<script src="js/algum-arquivo.js?v=20260623-asset1"></script>
```

CDNs externos não devem receber `?v=`.

## 3. Regra para `js/boot.js`

`js/boot.js` é o entrypoint do app.

Ele pode conter:

* definição das rotas;
* bootstrap inicial;
* chamada de `loadCurrentUser`;
* decisão de navegar para login ou rota atual;
* listener de `hashchange`;
* proteção de `DOMContentLoaded`.

Ele não deve conter:

* renderização de tela;
* lógica de OP;
* lógica de entrega;
* Supabase write;
* funções de cadastro;
* helpers de domínio.

`main()` não deve ser chamado diretamente antes do DOM estar pronto.

## 4. Regra para `js/router.js`

`js/router.js` é engine genérica de roteamento.

Ele pode conter:

* registro de rotas;
* matching de hash;
* navegação;
* fallback de rota;
* chamada de handlers.

Ele não deve conter:

* lista específica de telas do app;
* lógica de autenticação;
* lógica de OP;
* Supabase;
* HTML de tela.

## 5. Regra para `js/ui.js`

`js/ui.js` contém primitives de UI genéricas.

Ele pode conter:

* `setApp`;
* helpers de elemento;
* modal;
* toast;
* shell layout;
* tabela genérica;
* inputs genéricos.

Ele não deve conter:

* regra de negócio;
* chamada Supabase;
* lógica específica de OP;
* lógica específica de fornecedor;
* lógica específica de entrega.

O root `#app` deve ser buscado em tempo de uso, não capturado cedo demais antes do DOM existir.

## 6. Regra para screens

Arquivos em `js/screens/` devem representar telas, blocos de tela ou domínios coesos.

Exemplos aceitos:

* `op-nova.js`;
* `op-pdf.js`;
* `op-persistir.js`;
* `op-recalculo.js`;
* `op-writes.js`;
* `entrega-writes.js`;
* `painel.js`;
* `fornecedor.js`.

Uma screen pode orquestrar estado local e renderização.

Uma screen não deve virar depósito indiscriminado de:

* writes;
* helpers puros;
* PDF;
* regras de cálculo;
* formatação genérica;
* funções de outras telas.

## 7. Regra de tamanho

Limites de referência:

* arquivo ideal: até 250 linhas;
* arquivo aceitável: até 500 linhas;
* arquivo excepcional: até 900 linhas, somente se for uma tela coesa com closure local;
* função ideal: até 80 linhas;
* função aceitável: até 150 linhas;
* função excepcional: acima de 150 linhas somente com justificativa.

`op-nova.js` é exceção aceita e congelada. Não usar `op-nova.js` como precedente para criar novas telas grandes.

Se um novo arquivo passar de 500 linhas, o IAexec deve justificar por que não foi dividido.

Se uma nova função passar de 150 linhas, o IAexec deve justificar por que não foi dividida.

## 8. Regra para helpers puros

Helpers puros devem ser extraídos quando:

* não dependem de DOM;
* não dependem de Supabase;
* não dependem de estado de closure;
* recebem dados por argumento;
* retornam valor previsível;
* são testáveis isoladamente.

Helpers puros não devem acessar `window.supa`.

## 9. Regra para writes Supabase

Writes Supabase devem ficar em módulos explícitos de escrita, como:

* `op-writes.js`;
* `op-persistir.js`;
* `op-recalculo.js`;
* `entrega-writes.js`.

Funções de render não devem fazer `insert`, `update`, `delete` ou `upsert`.

Qualquer novo write deve declarar:

* tabela afetada;
* tipo de operação;
* payload;
* comportamento de erro;
* se há risco de estado parcial;
* teste smoke correspondente.

Se um fluxo escrever em múltiplas tabelas, deve haver nota explícita sobre atomicidade ou risco de operação parcial.

## 10. Regra para reads Supabase

Reads podem permanecer em screens quando forem simples e ligados à montagem da tela.

Reads devem ser extraídos quando:

* forem reutilizados por mais de uma tela;
* tiverem joins complexos;
* tiverem filtros de permissão;
* virarem fonte de bugs recorrentes;
* excederem a responsabilidade da tela.

## 11. Regra para autenticação e perfil

O app depende de:

```text
auth.users.id = public.usuarios.id
```

Nenhum patch deve alterar essa regra sem decisão explícita.

Se login Auth funcionar, mas o app voltar para login, verificar primeiro:

```sql
select id, email, nome, tipo, fornecedor_id
from public.usuarios
where id = '<auth-user-id>';
```

Não alterar `auth.js` para mascarar ausência de perfil.

## 12. Regra para cache-busting

Todos os assets locais carregados por `index.html` devem manter query string de versão.

Exemplo:

```html
<script src="js/screens/op-pdf.js?v=20260623-asset1"></script>
```

Ao adicionar novo JS local:

* inserir na ordem correta;
* aplicar a versão vigente;
* atualizar smoke tests para aceitar `?v=`;
* não aplicar `?v=` em CDNs externos.

## 13. Regra para testes

Todo patch deve ter teste proporcional ao risco.

Padrão mínimo:

* `node --check` nos arquivos JS alterados;
* smoke test do módulo alterado;
* smoke test da rota/boot se alterar `index.html`, `boot.js` ou ordem de scripts;
* smoke test de writes se alterar persistência;
* teste local manual quando alterar boot, UI, auth ou tela crítica.

Não rodar suíte completa por padrão se a fase não exigir.

## 14. Regra para fases

Cada fase deve ter escopo único.

Não misturar:

* diagnóstico com patch;
* refactor com feature;
* docs com código;
* Supabase com frontend;
* produção com staging;
* correção de teste com mudança funcional ampla.

Se a fase tocar mais de 3 domínios, deve ser quebrada.

## 15. Regra para Git

Antes de qualquer patch:

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Proibido:

* `git add .`;
* `git reset --hard`;
* `git rebase`;
* `git push --force`;
* push para `origin` sem autorização explícita.

Permitido:

* staging seletivo;
* commit pequeno;
* push para `staging work/app-next:main` quando autorizado.

## 16. Regra para documentação

Atualizar docs quando houver:

* novo módulo estrutural;
* mudança de entrypoint;
* mudança de rota;
* mudança de write helper;
* mudança de contrato Supabase;
* congelamento ou descongelamento de refactor;
* decisão arquitetural relevante.

Docs principais:

* `PROJECT_STATE.md`;
* `AGENT_HANDOFF.md`;
* `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`;
* `docs/architecture/CODE_HEALTH_RULES.md`.

## 17. Critérios de bloqueio arquitetural

Um patch deve ser bloqueado se:

* recolocar lógica pesada em `index.html`;
* adicionar write Supabase dentro de render;
* remover cache-busting sem substituto;
* alterar `auth.js` para esconder ausência de perfil;
* tocar `origin/main` sem autorização;
* misturar refactor amplo com feature;
* criar tela grande sem justificativa;
* alterar ordem de scripts sem teste;
* quebrar smoke tests e tratar como irrelevante sem prova.

## 18. Auditoria periódica

A cada conjunto relevante de features, rodar uma auditoria read-only:

* maiores arquivos;
* maiores funções;
* novos writes Supabase;
* scripts em `index.html`;
* rotas novas;
* testes existentes;
* riscos de atomicidade;
* pendências de documentação.

A auditoria deve concluir com:

* continuar;
* fazer micro-refactor;
* congelar;
* ou abrir fase específica de correção.
