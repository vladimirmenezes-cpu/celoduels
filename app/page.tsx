"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { keccak256, encodePacked, parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { CELODUELS_ADDRESS, CELODUELS_ABI, CUSD_ADDRESS, CUSD_ABI } from "./lib/contracts";

const Move = { ROCK: 1, PAPER: 2, SCISSORS: 3 } as const;
type MoveType = (typeof Move)[keyof typeof Move];

function generateSalt(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateHash(move: MoveType, salt: string): `0x${string}` {
  return keccak256(encodePacked(["uint8", "string"], [move, salt]));
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();

  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);
  const [gameId, setGameId] = useState<string>("");
  const [salt, setSalt] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"create" | "join" | "reveal">("create");

  const moveEmoji = { 1: "✊", 2: "✋", 3: "✌️" };
  const moveName = { 1: "Pedra", 2: "Papel", 3: "Tesoura" };

  async function handleCreateGame() {
    if (!selectedMove) return setStatus("Escolha um move!");
    try {
      setStatus("Aprovando cUSD...");
      const newSalt = generateSalt();
      setSalt(newSalt);
      const hash = generateHash(selectedMove, newSalt);

      await writeContractAsync({
        address: CUSD_ADDRESS,
        abi: CUSD_ABI,
        functionName: "approve",
        args: [CELODUELS_ADDRESS, parseEther("0.1")],
      });

      setStatus("Criando jogo...");
      await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "createGame",
        args: [hash],
      });

      setStatus(`Jogo criado! Seu salt: ${newSalt} — GUARDE ISSO!`);
    } catch (e: any) {
      setStatus(`Erro: ${e.message}`);
    }
  }

  async function handleJoinGame() {
    if (!selectedMove || !gameId) return setStatus("Escolha um move e insira o Game ID!");
    try {
      setStatus("Aprovando cUSD...");
      const newSalt = generateSalt();
      setSalt(newSalt);
      const hash = generateHash(selectedMove, newSalt);

      await writeContractAsync({
        address: CUSD_ADDRESS,
        abi: CUSD_ABI,
        functionName: "approve",
        args: [CELODUELS_ADDRESS, parseEther("0.1")],
      });

      setStatus("Entrando no jogo...");
      await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "joinGame",
        args: [BigInt(gameId), hash],
      });

      setStatus(`Entrou no jogo! Seu salt: ${newSalt} — GUARDE ISSO!`);
    } catch (e: any) {
      setStatus(`Erro: ${e.message}`);
    }
  }

  async function handleReveal() {
    if (!selectedMove || !gameId || !salt) return setStatus("Preencha todos os campos!");
    try {
      setStatus("Revelando move...");
      await writeContractAsync({
        address: CELODUELS_ADDRESS,
        abi: CELODUELS_ABI,
        functionName: "revealMove",
        args: [BigInt(gameId), selectedMove, salt],
      });
      setStatus("Move revelado! Aguarde o resultado.");
    } catch (e: any) {
      setStatus(`Erro: ${e.message}`);
    }
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold">⚡ CeloDuels</h1>
        <p className="text-gray-400">Desafie amigos em RPS por cUSD</p>
        <button
          onClick={() => connect({ connector: injected() })}
          className="bg-yellow-400 text-black font-bold px-8 py-4 rounded-2xl text-lg"
        >
          Conectar Carteira
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-6 gap-6">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">⚡ CeloDuels</h1>
          <button onClick={() => disconnect()} className="text-sm text-gray-400 border border-gray-700 px-3 py-1 rounded-lg">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {(["create", "join", "reveal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl font-medium text-sm ${activeTab === tab ? "bg-yellow-400 text-black" : "bg-gray-900 text-gray-400"}`}
            >
              {tab === "create" ? "Criar" : tab === "join" ? "Entrar" : "Revelar"}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {(Object.entries(Move) as [string, MoveType][]).map(([name, value]) => (
            <button
              key={name}
              onClick={() => setSelectedMove(value)}
              className={`text-4xl p-4 rounded-2xl border-2 transition-all ${selectedMove === value ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-900"}`}
            >
              {moveEmoji[value]}
              <div className="text-xs mt-1 text-gray-400">{moveName[value]}</div>
            </button>
          ))}
        </div>

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
          <input
            type="text"
            placeholder="Seu salt secreto"
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-white"
          />
        )}

        <button
          onClick={activeTab === "create" ? handleCreateGame : activeTab === "join" ? handleJoinGame : handleReveal}
          className="w-full bg-yellow-400 text-black font-bold py-4 rounded-2xl text-lg"
        >
          {activeTab === "create" ? "Criar Duelo" : activeTab === "join" ? "Entrar no Duelo" : "Revelar Move"}
        </button>

        {status && (
          <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-xl text-sm text-yellow-400 break-all">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}