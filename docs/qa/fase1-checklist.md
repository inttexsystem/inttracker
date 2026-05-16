# QA — Fase 1 (Fundação)

## Cenário 1: Login como admin
- [ ] Entrar com `admin@tapetes.test` / `Admin123!`
- [ ] Tela redireciona pra `#/painel`
- [ ] Mostra "Bem-vindo, Murilo (Admin)"
- [ ] Botão "Sair" no canto superior direito
- [ ] Clicar em "Sair" leva de volta pra `#/login`

## Cenário 2: Login como fornecedor de fios
- [ ] Entrar com `algodao@tapetes.test` / `Fornec123!`
- [ ] Tela redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Fios Sul"

## Cenário 3: Login como tecelagem
- [ ] Entrar com `tecelagem@tapetes.test` / `Fornec123!`
- [ ] Redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Aurora"

## Cenário 4: Login como látex
- [ ] Entrar com `latex@tapetes.test` / `Fornec123!`
- [ ] Redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Premier"

## Cenário 5: Senha errada
- [ ] Tentar admin@tapetes.test / senhaerrada
- [ ] Toast vermelho "E-mail ou senha incorretos"
- [ ] Continua na tela de login

## Cenário 6: Acesso indevido a rota de admin
- [ ] Logar como `algodao@tapetes.test`
- [ ] Navegar manualmente pra `#/painel`
- [ ] Mostra tela "Acesso negado"

## Cenário 7: RLS bloqueando leitura indevida (Supabase Studio)
- [ ] No Supabase Studio, abrir SQL Editor
- [ ] Rodar como anon (não logado): `SELECT * FROM ops;` → deve retornar 0 linhas (ou erro)
- [ ] Em outro browser logado como tecelagem, abrir DevTools → Console e rodar:
      `await supa.from('fornecedores').select('*')` → deve retornar APENAS o registro "Tecelagem Aurora"
- [ ] Mesma chamada como admin no console → retorna os 4 fornecedores

## Cenário 8: Sessão persiste após reload
- [ ] Logar como admin
- [ ] Apertar F5
- [ ] Continua logado, vai direto pra `#/painel`
