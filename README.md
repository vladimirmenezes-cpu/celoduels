# ⚡ CeloDuels

> **Minigames P2P · 100% Onchain · Sem Intermediários**

CeloDuels é uma plataforma de minigames descentralizada construída sobre a **Celo Mainnet**, onde dois jogadores podem se desafiar em duelos com apostas em cripto, sem servidores, sem custódia e sem intermediários.

🔗 **Demo ao vivo:** [celoduels.vercel.app](https://celoduels.vercel.app/)

---

## 🎮 O que é o CeloDuels?

CeloDuels permite que qualquer pessoa com uma carteira Web3 entre em uma partida P2P (peer-to-peer) contra outro jogador. As apostas são travadas em contrato inteligente, o resultado é determinado onchain via mecanismo **Commit-Reveal**, e o vencedor recebe o prêmio automaticamente — tudo sem intermediários.

---

## ✨ Funcionalidades

- ⚡ **Sem servidor** — lógica 100% em smart contracts na Celo Mainnet
- 🔒 **Commit-Reveal** — sistema à prova de trapaças: os jogadores submetem um hash do seu movimento antes de revelar, eliminando a possibilidade de front-running
- 💰 **Aposta livre** — os jogadores definem o valor apostado em cada duelo
- 🤝 **P2P puro** — sem casas de apostas, sem rake, sem custódia de fundos
- 📱 **MiniPay compatível** — funciona nativamente no MiniPay e em qualquer carteira Web3 (MetaMask, etc.)

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Blockchain | [Celo Mainnet](https://celo.org/) |
| Smart Contracts | Solidity |
| Frontend | Next.js / React |
| Deploy | Vercel |
| Carteiras | MetaMask, MiniPay, WalletConnect |

---

## 🚀 Como jogar

1. **Conecte sua carteira** — MetaMask, MiniPay ou qualquer carteira Web3 compatível com Celo
2. **Crie ou entre em um duelo** — defina o valor da aposta
3. **Faça seu commit** — envie o hash do seu movimento (sem revelar ainda)
4. **Revele sua jogada** — após o adversário também commitar, ambos revelam
5. **Receba o prêmio** — o contrato envia automaticamente para o vencedor

---

## 🔐 Segurança — Mecanismo Commit-Reveal

O Commit-Reveal é um padrão criptográfico que evita trapaças em jogos onchain:

```
1. Jogador envia:  hash(movimento + salt)   ← ninguém vê o movimento real
2. Após ambos commitarem, cada um revela:   movimento + salt
3. O contrato verifica: hash(revelado) == commit original
4. Resultado calculado de forma justa e transparente
```

Isso garante que nenhum jogador consiga copiar a jogada do adversário antes de tomar sua decisão.

---

## 💻 Rodando localmente

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/celoduels.git
cd celoduels

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com seu RPC da Celo e endereço do contrato

# Rode em modo de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## 📦 Variáveis de Ambiente

```env
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

---

## 📄 Smart Contracts

Os contratos estão deployados na **Celo Mainnet**. O código é verificado e auditável no [Celo Explorer](https://explorer.celo.org/).

| Contrato | Endereço |
|---|---|
| CeloDuels Core | `0x...` |

> ⚠️ Substitua com os endereços reais dos contratos deployados.

---

## 🌐 Rede Celo

CeloDuels roda exclusivamente na **Celo Mainnet**:

| Parâmetro | Valor |
|---|---|
| Network Name | Celo Mainnet |
| Chain ID | 42220 |
| RPC URL | https://forno.celo.org |
| Symbol | CELO |
| Block Explorer | https://explorer.celo.org |

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra uma issue ou pull request.

```bash
git checkout -b feature/minha-feature
git commit -m "feat: adiciona nova feature"
git push origin feature/minha-feature
```

---

## 📜 Licença

MIT © CeloDuels

---

<div align="center">
  <strong>⚡ Powered by Celo Mainnet</strong><br/>
  Construído para a comunidade Web3
</div>
