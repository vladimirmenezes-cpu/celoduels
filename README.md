<div align="center">

# 🚲 GIRO

**Quanto mais você pedala, mais a cidade responde.**

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-00B6A9?style=for-the-badge)]()
[![Plataforma](https://img.shields.io/badge/plataforma-mobile-FF6800?style=for-the-badge)]()
[![Cidade](https://img.shields.io/badge/cidade-Salvador%20(BA)-FFC400?style=for-the-badge)]()

[🌐 Acessar o Projeto](https://giro-app-vtib.vercel.app/onboarding)

</div>

---

## 📖 Sobre o Projeto

O **GIRO** é um aplicativo mobile gamificado que transforma a cidade em um grande tabuleiro vivo. Usando a bicicleta como principal meio de interação, os usuários conquistam e defendem **territórios urbanos reais**, participam de desafios e interagem socialmente enquanto pedalam.

O foco não é performance esportiva — é **presença, frequência e interação social**.

> Cidade inicial: **Salvador (BA)**

---

## 🎮 Modos de Jogo

### 🟢 Modo Livre
Ideal para iniciantes. Permite explorar a cidade, completar desafios, ganhar XP e socializar, sem pressão de disputa territorial.

### 🔴 Modo Território
O modo principal. Territórios possuem donos (jogadores ou clãs). Quanto mais tempo você pedala em uma área, mais forte o seu domínio se torna. Constância vale mais do que velocidade.

---

## 🗺️ Sistema de Territórios

Cada território possui:

- **Dono** — jogador ou clã
- **Nível de domínio** — de 1 a 10
- **Estado** — 🟢 Estável · 🟡 Em disputa · 🔴 Vulnerável

| Ação | Regra |
|------|-------|
| Conquista inicial | 5 minutos pedalando na área |
| Proteção inicial | 15 minutos após conquista |
| Fortalecimento | +1 ponto de força a cada 5 min ativos |
| Subir de nível | A cada 6 pontos de força acumulados |
| Decaimento | −1 ponto após 24h sem atividade |

### ⚔️ Ataques e Defesa

O tempo para conquista de um território inimigo depende do seu nível e do número de atacantes:

```
Tempo = (Nível × 10 min) ÷ número de atacantes ativos
```

Ataques em grupo são altamente incentivados. Defensores ativos bloqueiam atacantes em proporção direta — 1 defensor anula 1 atacante.

---

## 🧩 Funcionalidades

- 📍 **GPS em tempo real** — rastreamento contínuo do percurso
- 🗺️ **Mapa com territórios** — visualização ao vivo de disputas
- 🏆 **Desafios da comunidade** — criados pelos próprios jogadores
- 👥 **Clãs** — domine territórios em grupo, com ranking próprio
- 🔍 **Aba Descobrir** — encontre jogadores próximos e pedais acontecendo agora
- 📊 **Rankings customizáveis** — filtre por período, métrica e amigos
- 🔔 **Alertas sociais** — receba notificações quando seu território estiver sendo atacado

---

## 🛠️ Stack Tecnológica

| Função | Tecnologia |
|--------|------------|
| App Mobile | Flutter |
| Mapas | Mapbox |
| GPS | Native GPS + Background Geolocation |
| Sistema de Territórios | H3 (Uber) |
| Backend Realtime | Supabase |
| Banco Geográfico | PostgreSQL + PostGIS |

---

## 🏗️ Arquitetura do Projeto

```
lib/
 ├── core/
 ├── gps/
 ├── map/
 ├── territories/
 ├── social/
 ├── clans/
 ├── auth/
 ├── realtime/
 ├── widgets/
 └── screens/
```

---

## 🚀 MVP — Funcionalidades Iniciais

- [x] GPS para bicicleta
- [x] Mapa com territórios
- [x] Modo Livre e Modo Território
- [x] Sistema de desafios
- [x] Funcionalidades sociais básicas
- [x] Rankings
- [ ] Clãs (em desenvolvimento)
- [ ] Eventos ao vivo

---

## 🎨 Identidade Visual

| Cor | Hex |
|-----|-----|
| 🔵 Azul Escuro | `#001830` |
| 🟢 Turquesa | `#00B6A9` |
| 🟠 Laranja | `#FF6800` |
| 🟡 Amarelo | `#FFC400` |
| 🩷 Rosa | `#FF4DA6` |
| 🟣 Roxo | `#6C4DFF` |
| 🤍 Creme | `#FFF7ED` |

---

## 👥 Público-Alvo

- Jovens e adultos em geral
- Pessoas sedentárias ou iniciantes em atividade física
- Ciclistas casuais
- Pessoas interessadas em eventos sociais urbanos

---

## 🗺️ Territórios Iniciais (Salvador)

- Barra
- Ondina
- Rio Vermelho
- Pituba
- Itapuã

---

## 🔮 Expansões Futuras

- Guerras entre clãs em escala de cidade
- Checkpoints e loot urbano
- Clima afetando territórios
- Sistema de temporadas
- Realidade aumentada
- IA de mobilidade urbana

---

<div align="center">

**GIRO** — *Transformando Salvador em uma experiência viva, social e interativa através do movimento.*

[🌐 Acessar o Projeto](https://giro-app-vtib.vercel.app/onboarding)

</div>
