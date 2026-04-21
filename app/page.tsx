"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { keccak256, encodePacked, parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { CELODUELS_ADDRESS, CELODUELS_ABI, GAME_TYPES, GameType } from "./lib/contracts";

function generateSalt(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateHash(move: number, salt: string): `0x${string}` {
  return keccak256(encodePacked(["uint8", "string"], [move, salt]));
}

const GAMES = [
  {
    type: GAME_TYPES.RPS,
    name: "Pedra Papel Tesoura",
    emoji: "✊",
    description: "Clássico RPS por 0.001 CELO",
    moves: [
      { value: 1, label: "Pedra", emoji: "✊" },
      { value: 2, label: "Papel", emoji: "✋" },
      { value: 3, label: "Tesoura", emoji: "✌️" },
    ],
  },
  {
    type: GAME_TYPES.COIN_FLIP,
    name: "Cara ou Coroa",
    emoji: "🪙",
    description: "50/50 — sorte pura",
    moves: [
      { value: 1, label: "Cara", emoji: "👑" },
      { value: 2, label: "Coroa", emoji: "🔵" },
    ],
  },
  {
    type: GAME_TYPES.ODD_EVEN,
    name: "Par ou Ímpar",
    emoji: "🔢",
    description: "P1 escolhe par/ímpar, P2 escolhe 1-10",
    moves: [
      { value: 1, label: "Par", emoji: "2️⃣" },
      { value: 2, label: "Ímpar", emoji: "1️⃣" },
      { value: 3, label: "3", emoji: "3️⃣" },
      { value: 4, label: "4", emoji: "4️⃣" },
      { value: 5, label: "5", emoji: "5️⃣" },
      { value: 6, label: "6", emoji: "6️⃣" },
      { value: 7, label: "7", emoji: "7️⃣" },
      { value: 8, label: "8", emoji: "8️⃣" },
      { value: 9, label: "9", emoji: "9️⃣" },
      { value: 10, label: "10", emoji: "🔟" },
    ],
  },
  {
    type: GAME_TYPES.DILEMMA,
    name: "Dilema do Prisioneiro",
    emoji: "🔒",
    description: "Cooperar ou trair? Você decide",
    moves: [
      { value: 1, label: "Cooperar", emoji: "🤝" },
      { value: 2, label: "Trair", emoji: "🗡️" },
    ],
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [screen, setScreen] = useState<"home" | "game">("home");
  const [selectedGame, setSelectedGame] = useState<typeof GAMES[0] | null>(null);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "join" | "reveal">("create");
  const [gameId, setGameId] = useState("");
  const [salt, setSalt] = useState("");
  const [status, setStatus] = useState("");
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [createdSalt, setCreatedSalt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function selectGame(game: typeof GAMES[0]) {
    setSelectedGame(game);
    setSelectedMove(null);
    setStatus("");
    setCreatedGameId(null);
    setCreatedSalt(null);
    setScreen("game");
  }

  async function handleCreateGame() {
    if (!selectedMove || !selectedGame) return setStatus("Escolha um move!");
    try {
      setLoading(true);
      setStatus("Aguardando confirmação...");
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);

      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "createGame",
        args: [hash, selectedGame.type as GameType],
        value: parseEther("0.001"),
      });

      setStatus("Confirmando na blockchain...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });

      const id = receipt.logs[0]?.topics[1]
        ? BigInt(receipt.logs[0].topics[1]).toString()
        : "0";

      setCreatedGameId(id);
      setCreatedSalt(newSalt);
      setSalt(newSalt);
      setStatus("Jogo criado!");
    } catch (e: any) {
      setStatus(`Erro: ${e.shortMessage ?? e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame() {
    if (!selectedMove || !gameId) return setStatus("Escolha um move e insira o Game ID!");
    try {
      setLoading(true);
      setStatus("Aguardando confirmação...");
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);

      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "joinGame",
        args: [BigInt(gameId), hash],
        value: parseEther("0.001"),
      });

      setStatus("Confirmando na blockchain...");
      await publicClient!.waitForTransactionReceipt({ hash: txHash });

      setCreatedSalt(newSalt);
      setSalt(newSalt);
      setStatus("Entrou no jogo! Guarde seu salt.");
    } catch (e: any) {
      setStatus(`Erro: ${e.shortMessage ?? e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal() {
    if (!selectedMove || !gameId || !salt) return setStatus("Preencha todos os campos!");
    try {
      setLoading(true);
      setStatus("Revelando move...");

      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "revealMove",
        args: [BigInt(gameId), selectedMove, salt],
      });

      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      setStatus("Move revelado! Aguarde o resultado.");
    } catch (e: any) {
      setStatus(`Erro: ${e.shortMessage ?? e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-4xl font-bold">⚡ CeloDuels</h1>
        <p className="text-gray-400 text-center">Desafie amigos em minigames por CELO</p>
        <button
          onClick={() => connect({ connector: injected() })}
          className="bg-yellow-400 text-black font-bold px-8 py-4 rounded-2xl text-lg"
        >
          Conectar Carteira
        </button>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">⚡ CeloDuels</h1>
            <button onClick={() => disconnect()} className="text-sm text-gray-400 border border-gray-700 px-3 py-1 rounded-lg">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          </div>

          <p className="text-gray-400 mb-6 text-sm">Escolha um jogo para jogar</p>

          <div className="flex flex-col gap-4">
            {GAMES.map((game) => (
              <button
                key={game.type}
                onClick={() => selectGame(game)}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 text-left hover:border-yellow-400/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{game.emoji}</span>
                  <div>
                    <div className="font-bold text-white">{game.name}</div>
                    <div className="text-sm text-gray-400 mt-1">{game.description}</div>
                  </div>
                  <span className="ml-auto text-yellow-400 text-xl">›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-6">
      <div className="w-full max-w-md">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setScreen("home")} className="text-gray-400 text-2xl">‹</button>
          <span className="text-2xl">{selectedGame?.emoji}</span>
          <h1 className="text-xl font-bold">{selectedGame?.name}</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {(["create", "join", "reveal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStatus(""); setCreatedGameId(null); }}
              className={`flex-1 py-2 rounded-xl font-medium text-sm ${activeTab === tab ? "bg-yellow-400 text-black" : "bg-gray-900 text-gray-400"}`}
            >
              {tab === "create" ? "Criar" : tab === "join" ? "Entrar" : "Revelar"}
            </button>
          ))}
        </div>

        {activeTab !== "reveal" && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              {activeTab === "create" && selectedGame?.type === GAME_TYPES.ODD_EVEN
                ? "Você é o Player 1 — escolha Par ou Ímpar"
                : activeTab === "join" && selectedGame?.type === GAME_TYPES.ODD_EVEN
                ? "Você é o Player 2 — escolha um número de 3 a 10"
                : "Escolha seu move"}
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {selectedGame?.moves
                .filter((m) => {
                  if (selectedGame.type !== GAME_TYPES.ODD_EVEN) return true;
                  if (activeTab === "create") return m.value <= 2;
                  return m.value >= 3;
                })
                .map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMove(m.value)}
                    className={`text-3xl p-4 rounded-2xl border-2 transition-all ${selectedMove === m.value ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-900"}`}
                  >
                    {m.emoji}
                    <div className="text-xs mt-1 text-gray-400">{m.label}</div>
                  </button>
                ))}
            </div>
          </>
        )}

        {(activeTab === "join" || activeTab === "reveal") && (
          <input
            type="text"
            placeholder="Game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-white"
          />
        )}

        {activeTab === "reveal" && (
          <>
            <input
              type="number"
              placeholder="Move (número que você escolheu)"
              value={selectedMove ?? ""}
              onChange={(e) => setSelectedMove(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-white"
            />
            <input
              type="text"
              placeholder="Seu salt secreto"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-white"
            />
          </>
        )}

        <button
          disabled={loading}
          onClick={activeTab === "create" ? handleCreateGame : activeTab === "join" ? handleJoinGame : handleReveal}
          className={`w-full font-bold py-4 rounded-2xl text-lg transition-all ${loading ? "bg-yellow-400/50 text-black/50 cursor-not-allowed" : "bg-yellow-400 text-black"}`}
        >
          {loading ? "Processando..." : activeTab === "create" ? "Criar Duelo (0.001 CELO)" : activeTab === "join" ? "Entrar no Duelo (0.001 CELO)" : "Revelar Move"}
        </button>

        {status && (
          <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-xl text-sm text-yellow-400">
            {status}
          </div>
        )}

        {createdGameId !== null && (
          <div className="mt-4 p-4 bg-gray-900 border border-yellow-400/30 rounded-xl flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Game ID — compartilhe com seu amigo</p>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-xl">#{createdGameId}</span>
                <button onClick={() => copyToClipboard(createdGameId)} className="text-xs text-gray-400 border border-gray-700 px-2 py-1 rounded-lg">copiar</button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Seu salt secreto — guarde para o Reveal!</p>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm break-all">{createdSalt}</span>
                <button onClick={() => copyToClipboard(createdSalt!)} className="text-xs text-gray-400 border border-gray-700 px-2 py-1 rounded-lg flex-shrink-0">copiar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}