# QA — Fase 2 (Admin Cadastros)

Pré-condição: logado como admin (`admin@tapetes.test` / `Admin123!`)

## Cenário 1 — Menu lateral
- [ ] Menu mostra 7 itens: Painel, Cores, Modelos, Parâmetros, Fornecedores, Preços, Usuários
- [ ] Cada item navega pra rota correspondente

## Cenário 2 — Cores: CRUD completo
- [ ] Lista mostra BRANCO, PRETO, BEGE (seed)
- [ ] "+ Nova cor" → criar VERMELHO → aparece na lista (toast verde)
- [ ] Editar VERMELHO pra ROXO → atualiza
- [ ] Excluir ROXO → confirmação → remove da lista
- [ ] Tentar excluir BRANCO (que está em uso por modelo) → toast vermelho "Cor em uso"

## Cenário 3 — Modelos: CRUD com cores
- [ ] Lista mostra "Conforto BRANCO/PRETO 1,40" e "Conforto PRETO/BRANCO 2,10" (seed)
- [ ] "+ Novo modelo" → criar "Premium BEGE/BRANCO 1,40" → aparece
- [ ] Editar para mudar cor 2 pra PRETO → atualiza
- [ ] Tentar criar duplicata exata (mesmo nome+cores+largura) → toast vermelho "Já cadastrado"
- [ ] Excluir o "Premium" criado → remove

## Cenário 4 — Parâmetros: edição
- [ ] Mostra 2 cards (1,40 e 2,10)
- [ ] Cada card mostra os 4 valores: peso linear, algodão/ml, poliéster/ml, valor x
- [ ] Editar valor x de 1,40 pra 1,5 → salvar → toast verde
- [ ] Recarregar a página (F5) → valor persistido
- [ ] Voltar valor pra 1,0 → salvar

## Cenário 5 — Fornecedores: CRUD com 4 tipos
- [ ] Lista mostra os 4 do seed (Fios Sul, Polifios, Aurora, Premier) com tipos formatados
- [ ] "+ Novo fornecedor" → criar "Teste LTDA" tipo "Látex" → aparece
- [ ] Editar tipo pra "Tecelagem" → atualiza
- [ ] Excluir "Teste LTDA" → remove
- [ ] Tentar excluir "Aurora" (vinculada a preço) → toast vermelho

## Cenário 6 — Preços: CRUD
- [ ] Lista mostra os 4 preços do seed (Aurora cima 1,40/2,10; Premier látex 1,40/2,10)
- [ ] "+ Novo preço" → o select só lista tecelagens e látex (NÃO mostra fornecedores de fio)
- [ ] Criar preço com um novo fornecedor de látex que você acabou de cadastrar → funciona
- [ ] Editar um preço existente → muda valor → toast verde
- [ ] Excluir um preço → remove

## Cenário 7 — Usuários: lista e vinculação
- [ ] Lista mostra os 4 usuários cadastrados na Fase 1
- [ ] Caixa amarela com instruções aparece no topo
- [ ] Editar nome do admin pra "Murilo" (sem o "(Admin)") → salva
- [ ] "+ Vincular usuário" com UID inventado → toast "UID não existe no Supabase Auth"
- [ ] "+ Vincular usuário" com UID válido (cria primeiro no Supabase Auth) → vincula

## Cenário 8 — Acesso fornecedor bloqueado
- [ ] Sair, logar como `algodao@tapetes.test`
- [ ] Editar URL pra `#/cadastros/cores` → tela "Acesso negado"
- [ ] Mesmo pra todas as outras rotas `#/cadastros/...`

## Cenário 9 — Validações de formulário
- [ ] Em qualquer modal, salvar com campos vazios → toast vermelho específico
- [ ] Em preços, salvar com preço negativo → toast vermelho
