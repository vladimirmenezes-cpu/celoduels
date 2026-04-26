"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useBalance } from "wagmi";
import { injected } from "wagmi/connectors";
import { keccak256, encodePacked, parseEther, formatEther } from "viem";
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
    short: "RPS",
    emoji: "✊",
    color: "#22C55E",
    colorDim: "#22C55E22",
    description: "O clássico. Sem trapaça possível.",
    moves: [
      { value: 1, label: "Pedra", emoji: "✊" },
      { value: 2, label: "Papel", emoji: "✋" },
      { value: 3, label: "Tesoura", emoji: "✌️" },
    ],
  },
  {
    type: GAME_TYPES.COIN_FLIP,
    name: "Cara ou Coroa",
    short: "Coin",
    emoji: "🪙",
    color: "#FACC15",
    colorDim: "#FACC1522",
    description: "50/50. Sorte pura, verificada onchain.",
    moves: [
      { value: 1, label: "Cara", emoji: "👑" },
      { value: 2, label: "Coroa", emoji: "🔵" },
    ],
  },
  {
    type: GAME_TYPES.ODD_EVEN,
    name: "Par ou Ímpar",
    short: "P/I",
    emoji: "🔢",
    color: "#3B82F6",
    colorDim: "#3B82F622",
    description: "P1 escolhe par/ímpar. P2 tenta adivinhar.",
    moves: [
      { value: 1, label: "Par", emoji: "2️⃣" },
      { value: 2, label: "Ímpar", emoji: "1️⃣" },
    ],
  },
  {
    type: GAME_TYPES.DILEMMA,
    name: "Dilema do Prisioneiro",
    short: "Dilema",
    emoji: "🔒",
    color: "#A855F7",
    colorDim: "#A855F722",
    description: "Cooperar ou trair? A blockchain decide.",
    moves: [
      { value: 1, label: "Cooperar", emoji: "🤝" },
      { value: 2, label: "Trair", emoji: "🗡️" },
    ],
  },
];

const GAME_TYPE_NAMES: Record<number, string> = { 0: "RPS", 1: "Coin Flip", 2: "Par/Ímpar", 3: "Dilema" };
const GAME_TYPE_COLORS: Record<number, string> = { 0: "#22C55E", 1: "#FACC15", 2: "#3B82F6", 3: "#A855F7" };

type Screen = "dashboard" | "lobby" | "game";
type Tab = "create" | "join" | "reveal";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: balance } = useBalance({ address });

  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedGame, setSelectedGame] = useState<typeof GAMES[0] | null>(null);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("create");
  const [gameId, setGameId] = useState("");
  const [salt, setSalt] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [createdSalt, setCreatedSalt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<Array<{ id: string; game: string; result: "win" | "loss" | "draw"; amount: string }>>([]);

  const { data: openGames, refetch: refetchGames } = useReadContract({
    address: CELODUELS_ADDRESS,
    abi: CELODUELS_ABI,
    functionName: "getOpenGames",
  });

  useEffect(() => {
    const interval = setInterval(() => refetchGames(), 8000);
    return () => clearInterval(interval);
  }, []);

  function setMsg(msg: string, type: "info" | "success" | "error" = "info") {
    setStatus(msg); setStatusType(type);
  }

  function copy(text: string) { navigator.clipboard.writeText(text); }

  function goToGame(game: typeof GAMES[0], t: Tab = "create") {
    setSelectedGame(game);
    setSelectedMove(null);
    setStatus(""); setCreatedGameId(null); setCreatedSalt(null);
    setTab(t); setScreen("game");
  }

  async function handleCreate() {
    if (!selectedMove || !selectedGame) return setMsg("Escolha um move!", "error");
    try {
      setLoading(true); setMsg("Aguardando confirmação...");
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "createGame",
        args: [hash, selectedGame.type as GameType],
        value: parseEther("0.001"),
      });
      setMsg("Confirmando na blockchain...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      const id = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]).toString() : "0";
      setCreatedGameId(id); setCreatedSalt(newSalt); setSalt(newSalt);
      setMsg(`Duelo #${id} criado! Aguardando adversário...`, "success");
      refetchGames();
    } catch (e: any) { setMsg(`Erro: ${e.shortMessage ?? e.message}`, "error"); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!selectedMove || !gameId) return setMsg("Escolha um move e o Game ID!", "error");
    try {
      setLoading(true); setMsg("Aguardando confirmação...");
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "joinGame",
        args: [BigInt(gameId), hash],
        value: parseEther("0.001"),
      });
      setMsg("Confirmando...");
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      setCreatedSalt(newSalt); setSalt(newSalt);
      setMsg("Entrou! Guarde o salt para o Reveal.", "success");
      refetchGames();
    } catch (e: any) { setMsg(`Erro: ${e.shortMessage ?? e.message}`, "error"); }
    finally { setLoading(false); }
  }

  async function handleReveal() {
    if (!selectedMove || !gameId || !salt) return setMsg("Preencha todos os campos!", "error");
    try {
      setLoading(true); setMsg("Revelando move...");
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "revealMove",
        args: [BigInt(gameId), selectedMove, salt],
      });
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      setMsg("Move revelado! Aguarde o resultado.", "success");
    } catch (e: any) { setMsg(`Erro: ${e.shortMessage ?? e.message}`, "error"); }
    finally { setLoading(false); }
  }

  const openCount = (openGames as any[])?.length ?? 0;

  if (!isConnected) {
    return (
      <main style={{ background: "linear-gradient(135deg, #0B0E14 0%, #1A1B23 100%)" }}
        className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap');`}</style>
        <div className="text-center">
          <h1 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "4rem", fontWeight: 700, letterSpacing: "0.1em", background: "linear-gradient(90deg, #FACC15, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            CELODUELS
          </h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "1.1rem", marginTop: "0.5rem" }}>
            Minigames P2P · Blockchain Celo · 100% Justo
          </p>
        </div>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          {["⚡ Sem servidor", "🔒 Commit-Reveal", "💰 0.001 CELO"].map((f) => (
            <span key={f} style={{ color: "#9CA3AF", fontSize: "0.9rem", fontFamily: "DM Sans, sans-serif" }}>{f}</span>
          ))}
        </div>
        <button onClick={() => connect({ connector: injected() })}
          style={{ background: "linear-gradient(90deg, #FACC15, #F59E0B)", color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.2rem", letterSpacing: "0.05em", padding: "1rem 3rem", borderRadius: "1rem", border: "none", cursor: "pointer", boxShadow: "0 0 30px #FACC1544" }}>
          CONECTAR CARTEIRA
        </button>
      </main>
    );
  }

  const Sidebar = () => (
    <aside style={{ width: sidebarOpen ? "300px" : "0", minWidth: sidebarOpen ? "300px" : "0", overflow: "hidden", transition: "all 0.3s ease", background: "#0F1117", borderRight: "1px solid #1F2937", display: "flex", flexDirection: "column", gap: "0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap');`}</style>

      {/* Profile */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1F2937" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg, #FACC15, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", boxShadow: "0 0 20px #FACC1544" }}>
            ⚡
          </div>
          <div>
            <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1rem" }}>Jogador</div>
            <div style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.75rem" }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {[{ label: "Vitórias", value: "0", color: "#22C55E" }, { label: "Derrotas", value: "0", color: "#EF4444" }].map((s) => (
            <div key={s.label} style={{ background: "#1A1B23", borderRadius: "0.75rem", padding: "0.75rem", textAlign: "center" }}>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.5rem", color: s.color }}>{s.value}</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.7rem", color: "#6B7280" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1F2937" }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#9CA3AF", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>🏆 LEADERBOARD</div>
        {["—", "—", "—"].map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid #1F293733" }}>
            <span style={{ fontFamily: "Rajdhani, sans-serif", color: "#FACC15", fontWeight: 700, width: "1.5rem" }}>#{i + 1}</span>
            <div style={{ flex: 1, height: "8px", background: "#1F2937", borderRadius: "4px" }} />
          </div>
        ))}
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.7rem", color: "#4B5563", marginTop: "0.5rem" }}>Jogue para aparecer aqui</p>
      </div>

      {/* History */}
      <div style={{ padding: "1.5rem", flex: 1 }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#9CA3AF", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>📜 HISTÓRICO</div>
        {history.length === 0 ? (
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "#4B5563" }}>Nenhuma partida ainda.</p>
        ) : history.map((h) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span>{h.result === "win" ? "🟢" : h.result === "loss" ? "🔴" : "🟡"}</span>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "#D1D5DB" }}>{h.game} #{h.id}</span>
          </div>
        ))}
      </div>

      <button onClick={() => disconnect()} style={{ margin: "1rem", padding: "0.75rem", background: "#1A1B23", border: "1px solid #374151", borderRadius: "0.75rem", color: "#6B7280", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", cursor: "pointer" }}>
        Desconectar
      </button>
    </aside>
  );

  const Header = () => (
    <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #1F2937", display: "flex", alignItems: "center", gap: "1rem", background: "#0F1117" }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "1.2rem", cursor: "pointer" }}>☰</button>
      <h1 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.5rem", letterSpacing: "0.1em", background: "linear-gradient(90deg, #FACC15, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
        CELODUELS
      </h1>
      {screen !== "dashboard" && (
        <button onClick={() => setScreen("dashboard")} style={{ background: "none", border: "1px solid #374151", color: "#9CA3AF", padding: "0.4rem 1rem", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
          ‹ Voltar
        </button>
      )}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ background: "#1A1B23", border: "1px solid #FACC1544", borderRadius: "0.75rem", padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#FACC15", fontSize: "1rem" }}>💰</span>
          <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1rem" }}>
            {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : "—"} CELO
          </span>
        </div>
      </div>
    </header>
  );

  if (screen === "dashboard") {
    return (
      <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Header />
          <main style={{ padding: "2rem", flex: 1 }}>

            {/* Hero */}
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "2.5rem", color: "#F9FAFB", margin: 0 }}>
                CRIAR NOVO DUELO
              </h2>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", marginTop: "0.25rem" }}>
                Taxa de 1% · Contrato verificado · Resultado 100% onchain
              </p>
            </div>

            {/* Buscar partida */}
            <button onClick={() => { setScreen("lobby"); refetchGames(); }}
              style={{ width: "100%", marginBottom: "2rem", background: "linear-gradient(135deg, #1A1B23, #0F1117)", border: "1px solid #FACC1544", borderRadius: "1rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#FACC15")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#FACC1544")}>
              <span style={{ fontSize: "2rem" }}>🎮</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#FACC15", fontSize: "1.1rem" }}>BUSCAR PARTIDA</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.85rem" }}>Entrar em um duelo existente</div>
              </div>
              <div style={{ marginLeft: "auto", background: "#FACC1522", border: "1px solid #FACC1544", borderRadius: "2rem", padding: "0.25rem 0.75rem", fontFamily: "Rajdhani, sans-serif", color: "#FACC15", fontWeight: 700 }}>
                {openCount} aberto{openCount !== 1 ? "s" : ""}
              </div>
            </button>

            {/* Game Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
              {GAMES.map((game) => (
                <button key={game.type} onClick={() => goToGame(game)}
                  style={{ background: `linear-gradient(135deg, ${game.colorDim}, #0F1117)`, border: `1px solid ${game.color}44`, borderRadius: "1rem", padding: "1.5rem", textAlign: "left", cursor: "pointer", transition: "all 0.2s", backdropFilter: "blur(10px)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = `0 0 30px ${game.color}33`; e.currentTarget.style.borderColor = `${game.color}88`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = `${game.color}44`; }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{game.emoji}</div>
                  <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1.1rem", marginBottom: "0.25rem" }}>{game.name}</div>
                  <div style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.8rem", marginBottom: "1rem" }}>{game.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "Rajdhani, sans-serif", color: game.color, fontWeight: 700, fontSize: "0.9rem" }}>0.001 CELO</span>
                    <span style={{ color: game.color, fontSize: "1.2rem" }}>›</span>
                  </div>
                </button>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Header />
          <main style={{ padding: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "2rem", color: "#F9FAFB", margin: 0 }}>PARTIDAS ABERTAS</h2>
              <button onClick={() => refetchGames()} style={{ background: "#1A1B23", border: "1px solid #374151", color: "#9CA3AF", padding: "0.5rem 1rem", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                ↻ Atualizar
              </button>
            </div>

            {!openGames || (openGames as any[]).length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "#4B5563" }}>
                <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</p>
                <p style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.2rem", color: "#6B7280" }}>Nenhuma partida aberta</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", marginTop: "0.5rem" }}>Crie um jogo e aguarde!</p>
                <button onClick={() => setScreen("dashboard")} style={{ marginTop: "1.5rem", background: "linear-gradient(90deg, #FACC15, #F59E0B)", color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, padding: "0.75rem 2rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "1rem" }}>
                  CRIAR JOGO
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(openGames as any[])
                  .filter((g) => g.player1.toLowerCase() !== address?.toLowerCase())
                  .map((g) => {
                    const gType = Number(g.gameType);
                    const color = GAME_TYPE_COLORS[gType];
                    const game = GAMES.find((x) => x.type === gType);
                    return (
                      <div key={g.id.toString()} style={{ background: "#0F1117", border: `1px solid ${color}33`, borderRadius: "1rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontSize: "2rem" }}>{game?.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1rem" }}>{GAME_TYPE_NAMES[gType]}</div>
                          <div style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.8rem" }}>
                            #{g.id.toString()} · {g.player1.slice(0, 6)}...{g.player1.slice(-4)}
                          </div>
                        </div>
                        <div style={{ fontFamily: "Rajdhani, sans-serif", color, fontWeight: 700, fontSize: "0.9rem" }}>0.001 CELO</div>
                        <button onClick={() => { if (game) goToGame(game, "join"); setGameId(g.id.toString()); }}
                          style={{ background: color, color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, padding: "0.6rem 1.5rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "0.95rem" }}>
                          ENTRAR
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Game Screen
  return (
    <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <Header />
        <main style={{ padding: "2rem", maxWidth: "600px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ fontSize: "2.5rem" }}>{selectedGame?.emoji}</span>
            <div>
              <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: "#F9FAFB", margin: 0 }}>{selectedGame?.name.toUpperCase()}</h2>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.85rem", margin: 0 }}>{selectedGame?.description}</p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", background: "#0F1117", padding: "0.25rem", borderRadius: "0.75rem" }}>
            {(["create", "join", "reveal"] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setStatus(""); setCreatedGameId(null); }}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.05em", background: tab === t ? (selectedGame?.color ?? "#FACC15") : "transparent", color: tab === t ? "#0B0E14" : "#6B7280", transition: "all 0.2s" }}>
                {t === "create" ? "CRIAR" : t === "join" ? "ENTRAR" : "REVELAR"}
              </button>
            ))}
          </div>

          {/* Moves */}
          {tab !== "reveal" && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#9CA3AF", fontSize: "0.85rem", marginBottom: "1rem" }}>
                {tab === "create" && selectedGame?.type === GAME_TYPES.ODD_EVEN ? "Você é P1 — escolha Par ou Ímpar" : tab === "join" && selectedGame?.type === GAME_TYPES.ODD_EVEN ? "Você é P2 — escolha Par ou Ímpar" : "Escolha seu move"}
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {selectedGame?.moves.map((m) => (
                  <button key={m.value} onClick={() => setSelectedMove(m.value)}
                    style={{ flex: "1", minWidth: "100px", padding: "1.5rem 1rem", borderRadius: "1rem", border: `2px solid ${selectedMove === m.value ? (selectedGame.color) : "#1F2937"}`, background: selectedMove === m.value ? `${selectedGame.color}22` : "#0F1117", cursor: "pointer", transition: "all 0.2s", boxShadow: selectedMove === m.value ? `0 0 20px ${selectedGame.color}44` : "none" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{m.emoji}</div>
                    <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: selectedMove === m.value ? selectedGame.color : "#9CA3AF", fontSize: "0.95rem" }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inputs */}
          {(tab === "join" || tab === "reveal") && (
            <input type="text" placeholder="Game ID" value={gameId} onChange={(e) => setGameId(e.target.value)}
              style={{ width: "100%", background: "#0F1117", border: "1px solid #1F2937", borderRadius: "0.75rem", padding: "0.875rem 1rem", color: "#F9FAFB", fontFamily: "DM Sans, sans-serif", fontSize: "1rem", marginBottom: "0.75rem", outline: "none" }} />
          )}
          {tab === "reveal" && (
            <>
              <input type="number" placeholder="Move (número)" value={selectedMove ?? ""} onChange={(e) => setSelectedMove(Number(e.target.value))}
                style={{ width: "100%", background: "#0F1117", border: "1px solid #1F2937", borderRadius: "0.75rem", padding: "0.875rem 1rem", color: "#F9FAFB", fontFamily: "DM Sans, sans-serif", fontSize: "1rem", marginBottom: "0.75rem", outline: "none" }} />
              <input type="text" placeholder="Salt secreto" value={salt} onChange={(e) => setSalt(e.target.value)}
                style={{ width: "100%", background: "#0F1117", border: "1px solid #1F2937", borderRadius: "0.75rem", padding: "0.875rem 1rem", color: "#F9FAFB", fontFamily: "DM Sans, sans-serif", fontSize: "1rem", marginBottom: "0.75rem", outline: "none" }} />
            </>
          )}

          {/* Action Button */}
          <button disabled={loading}
            onClick={tab === "create" ? handleCreate : tab === "join" ? handleJoin : handleReveal}
            style={{ width: "100%", padding: "1rem", borderRadius: "0.875rem", border: "none", cursor: loading ? "not-allowed" : "pointer", background: loading ? "#374151" : `linear-gradient(90deg, ${selectedGame?.color ?? "#FACC15"}, ${selectedGame?.color ?? "#FACC15"}CC)`, color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.05em", transition: "all 0.2s", boxShadow: loading ? "none" : `0 0 30px ${selectedGame?.color ?? "#FACC15"}44` }}>
            {loading ? "PROCESSANDO..." : tab === "create" ? "CRIAR DUELO · 0.001 CELO" : tab === "join" ? "ENTRAR NO DUELO · 0.001 CELO" : "REVELAR MOVE"}
          </button>

          {/* Status */}
          {status && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "#0F1117", border: `1px solid ${statusType === "success" ? "#22C55E44" : statusType === "error" ? "#EF444444" : "#374151"}`, borderRadius: "0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", color: statusType === "success" ? "#22C55E" : statusType === "error" ? "#EF4444" : "#9CA3AF" }}>
              {status}
            </div>
          )}

          {/* Created Game Info */}
          {createdGameId !== null && (
            <div style={{ marginTop: "1rem", padding: "1.25rem", background: "#0F1117", border: `1px solid ${selectedGame?.color ?? "#FACC15"}44`, borderRadius: "0.875rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.75rem", marginBottom: "0.5rem" }}>GAME ID — compartilhe com seu adversário</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: selectedGame?.color ?? "#FACC15", fontSize: "2rem" }}>#{createdGameId}</span>
                  <button onClick={() => copy(createdGameId)} style={{ background: "#1A1B23", border: "1px solid #374151", color: "#9CA3AF", padding: "0.35rem 0.75rem", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem" }}>copiar</button>
                </div>
              </div>
              <div>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.75rem", marginBottom: "0.5rem" }}>SALT SECRETO — guarde para o Reveal!</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontFamily: "monospace", color: "#F9FAFB", fontSize: "0.85rem", wordBreak: "break-all" }}>{createdSalt}</span>
                  <button onClick={() => copy(createdSalt!)} style={{ background: "#1A1B23", border: "1px solid #374151", color: "#9CA3AF", padding: "0.35rem 0.75rem", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", flexShrink: 0 }}>copiar</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}