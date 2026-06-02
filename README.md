# Controle de Produção de Tapetes

Sistema para controlar a produção de tapetes do Murilo, do pedido de fios até a entrega final.

## Stack

- HTML único hospedado no GitHub Pages
- Tailwind CSS via CDN
- Supabase (Postgres + Auth + RLS) — plano free

## Documentação

- **Assumindo o projeto? Comece aqui:** [`docs/HANDOFF.md`](docs/HANDOFF.md)
- Estado de cada fase: [`docs/superpowers/STATUS.md`](docs/superpowers/STATUS.md)
- Design completo: [`docs/superpowers/specs/2026-05-16-controle-tapetes-design.md`](docs/superpowers/specs/2026-05-16-controle-tapetes-design.md)
- Plano da Fase 1: [`docs/superpowers/plans/2026-05-16-fase1-fundacao.md`](docs/superpowers/plans/2026-05-16-fase1-fundacao.md)

## Como rodar localmente

1. Configure as credenciais do Supabase no topo do `<script>` em `index.html`
2. Abra o `index.html` direto no navegador (duplo clique) OU rode um servidor estático:
   ```bash
   python3 -m http.server 8000
   # depois acesse http://localhost:8000
   ```

## Como subir alteração

```bash
git add .
git commit -m "<mensagem>"
git push
```

GitHub Pages publica automaticamente em ~1min.

## Usuários de teste (Fase 1)

| Email                     | Senha       | Tipo                  |
|---------------------------|-------------|-----------------------|
| admin@tapetes.test        | Admin123!   | admin                 |
| algodao@tapetes.test      | Fornec123!  | fornecedor (fio)      |
| tecelagem@tapetes.test    | Fornec123!  | fornecedor (cima)     |
| latex@tapetes.test        | Fornec123!  | fornecedor (látex)    |
