# Nort Park — Agendamento de Quadras

Protótipo funcional de um sistema de agendamento para o complexo esportivo
**Nort Park** (identidade visual laranja / preto / branco).

## Tecnologias

React 18, JavaScript e Vite 5, com dados de demonstração em localStorage.

## Fluxo implementado

1. **Landing** → apresentação do complexo e CTA para criar conta.
2. **Login / Cadastro** (nome, e-mail, telefone, senha).
3. **Escolha da quadra** — 6 quadras mockadas (Society, Futsal, Beach Tennis,
   Vôlei de areia, Padel), cada uma com preço por hora.
4. **Escolha de data e horário** — grade de horários das 07h às 23h, com
   alguns já marcados como "ocupado".
5. **Checkout** — resumo da reserva e a política de cancelamento (50% de
   reembolso) exibida antes do pagamento.
6. **Pagamento via Pix** — tela com QR Code, código "copia e cola" e timer de
   expiração (10 min). Botão "Já paguei / simular confirmação" avança o fluxo.
7. **Confirmação** da reserva.
8. **Minhas Reservas** — lista de agendamentos do usuário, com opção de
   **cancelar**. Ao cancelar, um modal mostra o cálculo do reembolso (50% do
   valor pago) antes de confirmar.

## Como rodar

```bash
npm ci
npm run dev
```

É necessário Node.js 18 ou superior e npm. Abra a URL exibida pelo Vite no terminal (normalmente `http://localhost:5173`).

Para gerar e visualizar a versão de produção:

```bash
npm run build
npm run preview
```

## O que é protótipo (e o que muda em produção)

Este projeto usa `localStorage` como "banco de dados" só para permitir testar
o fluxo inteiro sem depender de infraestrutura externa. Para virar produto
real:

- **Autenticação** → trocar `src/lib/mockBackend.js` por um provedor de
  verdade (ex.: Supabase Auth, Firebase Auth), com hashing de senha e sessão
  segura — nunca senha em texto puro em `localStorage`.
- **Quadras, horários e reservas** → mover para um banco (Postgres/Supabase),
  com uma tabela `reservas` (quadra, data, hora, usuário, status, valor,
  valor_reembolsado) e uma constraint de unicidade em (quadra, data, hora)
  para evitar overbooking — hoje o "horário ocupado" é só simulado por um hash
  determinístico.
- **Pagamento Pix** → o QR Code e o código copia-e-cola aqui são gerados
  localmente só para fins visuais (não são um Pix real). Em produção:
  1. O backend chama a API de um PSP que processa Pix no Brasil (Mercado
     Pago, Efí/Gerencianet, PagSeguro, Asaas etc.) para criar a cobrança e
     obter o payload EMV oficial + QR Code.
  2. O PSP notifica o backend via **webhook** quando o Pix é pago — é isso
     que confirma a reserva de verdade (o botão "já paguei" aqui é só uma
     simulação para não depender de credenciais reais).
  3. **Cancelamento com reembolso de 50%** → o backend deve disparar um Pix
     de devolução (endpoint de refund do PSP) na chave de origem do
     pagamento, e só então marcar a reserva como cancelada.
- **Hospedagem** → front-end estático (Vercel/Netlify) + Edge Functions para
  qualquer coisa que use chave secreta (Pix, e-mail de confirmação etc.).

## Estrutura

```
nort-park/
├── src/
│   ├── App.jsx              → todas as telas do fluxo
│   ├── index.css             → identidade visual (laranja/preto/branco)
│   ├── components/PixQRCode.jsx → QR code visual (placeholder)
│   └── lib/mockBackend.js    → dados mockados (quadras, auth, reservas, Pix)
├── index.html
├── package.json
└── vite.config.js
```
