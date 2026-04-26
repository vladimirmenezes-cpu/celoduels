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
    type: GAME_TYPES.RPS, name: "Pedra Papel Tesoura", short: "RPS", emoji: "✊",
    color: "#35D07F", colorDim: "#35D07F22",
    description: "O clássico. Sem trapaça possível.",
    moves: [{ value: 1, label: "Pedra", emoji: "✊" }, { value: 2, label: "Papel", emoji: "✋" }, { value: 3, label: "Tesoura", emoji: "✌️" }],
  },
  {
    type: GAME_TYPES.COIN_FLIP, name: "Cara ou Coroa", short: "Coin", emoji: "🪙",
    color: "#FBCC5C", colorDim: "#FBCC5C22",
    description: "50/50. Sorte pura, verificada onchain.",
    moves: [{ value: 1, label: "Cara", emoji: "👑" }, { value: 2, label: "Coroa", emoji: "🔵" }],
  },
  {
    type: GAME_TYPES.ODD_EVEN, name: "Par ou Ímpar", short: "P/I", emoji: "🔢",
    color: "#3B82F6", colorDim: "#3B82F622",
    description: "Escolha Par ou Ímpar — a soma decide.",
    moves: [{ value: 1, label: "Par", emoji: "2️⃣" }, { value: 2, label: "Ímpar", emoji: "1️⃣" },
      { value: 3, label: "3", emoji: "3️⃣" }, { value: 4, label: "4", emoji: "4️⃣" },
      { value: 5, label: "5", emoji: "5️⃣" }, { value: 6, label: "6", emoji: "6️⃣" },
      { value: 7, label: "7", emoji: "7️⃣" }, { value: 8, label: "8", emoji: "8️⃣" },
      { value: 9, label: "9", emoji: "9️⃣" }, { value: 10, label: "10", emoji: "🔟" }],
  },
  {
    type: GAME_TYPES.DILEMMA, name: "Dilema do Prisioneiro", short: "Dilema", emoji: "🔒",
    color: "#A855F7", colorDim: "#A855F722",
    description: "Cooperar ou trair? A blockchain decide.",
    moves: [{ value: 1, label: "Cooperar", emoji: "🤝" }, { value: 2, label: "Trair", emoji: "🗡️" }],
  },
];

const GAME_TYPE_NAMES: Record<number, string> = { 0: "RPS", 1: "Coin Flip", 2: "Par/Ímpar", 3: "Dilema" };
const GAME_TYPE_COLORS: Record<number, string> = { 0: "#35D07F", 1: "#FBCC5C", 2: "#3B82F6", 3: "#A855F7" };
type Screen = "dashboard" | "lobby" | "game" | "playing";

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
`;

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
  const [stakeAmount, setStakeAmount] = useState("0.001");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error" | "warning">("info");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [joinGameId, setJoinGameId] = useState("");
  const [savedSalt, setSavedSalt] = useState<string | null>(null);

useEffect(() => {
  if (typeof window !== "undefined" && (window as any).ethereum?.isMiniPay) {
    connect({ connector: injected() });
  }
}, []);

  const { data: openGames, refetch: refetchGames } = useReadContract({
    address: CELODUELS_ADDRESS,
    abi: CELODUELS_ABI,
    functionName: "getOpenGames",
  });

  const { data: activeGame, refetch: refetchActiveGame } = useReadContract({
    address: CELODUELS_ADDRESS,
    abi: CELODUELS_ABI,
    functionName: "getGame",
    args: activeGameId ? [BigInt(activeGameId)] : undefined,
    query: { enabled: !!activeGameId, refetchInterval: 3000 },
  }) as any;

  useEffect(() => {
    if (!activeGame || !activeGameId || !address) return;
    const state = Number(activeGame.state);

    if (state === 1 && savedSalt && selectedMove) {
      setMsg("Adversário entrou! Revelando automaticamente...", "info");
      autoReveal(activeGameId, selectedMove, savedSalt);
    }

    if (state === 3) {
      const iAmP1 = activeGame.player1.toLowerCase() === address.toLowerCase();
      const myWins = iAmP1 ? Number(activeGame.wins1 ?? 0) : Number(activeGame.wins2 ?? 0);
      const theirWins = iAmP1 ? Number(activeGame.wins2 ?? 0) : Number(activeGame.wins1 ?? 0);
      if (myWins > theirWins) setMsg("🏆 Você venceu! CELO enviado para sua carteira.", "success");
      else if (theirWins > myWins) setMsg("😔 Você perdeu. Mais sorte na próxima!", "error");
      else setMsg("🤝 Empate! Valor devolvido.", "warning");
    }
  }, [activeGame]);

  async function autoReveal(gId: string, move: number, salt: string) {
    try {
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "revealMove", args: [BigInt(gId), move, salt],
      });
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      setMsg("Move revelado! Aguardando adversário revelar...", "info");
      refetchActiveGame();
    } catch (e: any) {
      setMsg(`Erro no reveal: ${e.shortMessage ?? e.message}`, "error");
    }
  }

  function setMsg(msg: string, type: "info" | "success" | "error" | "warning" = "info") {
    setStatus(msg); setStatusType(type);
  }

  function goToGame(game: typeof GAMES[0]) {
    setSelectedGame(game); setSelectedMove(null); setJoinGameId("");
    setStatus(""); setActiveGameId(null); setSavedSalt(null);
    setStakeAmount("0.001"); setScreen("game");
  }

  async function handleCreate() {
    if (!selectedMove || !selectedGame) return setMsg("Escolha um move!", "error");
    const stakeVal = parseFloat(stakeAmount);
    if (isNaN(stakeVal) || stakeVal < 0.0001 || stakeVal > 10)
      return setMsg("Aposta deve ser entre 0.0001 e 10 CELO", "error");
    try {
      setLoading(true); setMsg("Aguardando confirmação na carteira...");
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "createGame",
        args: [hash, selectedGame.type as GameType],
        value: parseEther(stakeAmount),
      });
      setMsg("Confirmando na blockchain...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      const id = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]).toString() : "0";
      setSavedSalt(newSalt);
      setActiveGameId(id);
      setScreen("playing");
      setMsg(`Duelo #${id} criado! Apostando ${stakeAmount} CELO. Aguardando adversário...`, "info");
      refetchGames();
    } catch (e: any) { setMsg(`Erro: ${e.shortMessage ?? e.message}`, "error"); }
    finally { setLoading(false); }
  }

  async function handleJoin(gId?: string, stakeWei?: bigint) {
    const id = gId ?? joinGameId;
    if (!selectedMove || !id) return setMsg("Escolha um move e o Game ID!", "error");
    try {
      setLoading(true); setMsg("Entrando no duelo...");
      let finalStake = stakeWei;
      if (!finalStake) {
        const gameData = await publicClient!.readContract({
          address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
          functionName: "getGame", args: [BigInt(id)],
        }) as any;
        finalStake = gameData.stake;
      }
      const newSalt = generateSalt();
      const hash = generateHash(selectedMove, newSalt);
      const txHash = await writeContractAsync({
        address: CELODUELS_ADDRESS, abi: CELODUELS_ABI,
        functionName: "joinGame", args: [BigInt(id), hash],
        value: finalStake,
      });
      setMsg("Confirmando...");
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      setSavedSalt(newSalt);
      setActiveGameId(id);
      setScreen("playing");
      setMsg(`Entrou no duelo! Revelando move automaticamente...`, "info");
      refetchGames();
      refetchActiveGame();
      await autoReveal(id, selectedMove, newSalt);
    } catch (e: any) { setMsg(`Erro: ${e.shortMessage ?? e.message}`, "error"); }
    finally { setLoading(false); }
  }

  const openCount = (openGames as any[])?.length ?? 0;
  const statusColors = { info: "#9CA3AF", success: "#35D07F", error: "#EF4444", warning: "#FBCC5C" };

  // ─── CONNECT ──────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <main style={{ background: "linear-gradient(135deg, #0B0E14 0%, #0F1A14 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2rem", padding: "2rem" }}>
        <style>{fonts}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: "linear-gradient(135deg, #35D07F, #FBCC5C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem", boxShadow: "0 0 40px #35D07F44" }}>⚡</div>
          <h1 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "3.5rem", fontWeight: 700, letterSpacing: "0.1em", background: "linear-gradient(90deg, #35D07F, #FBCC5C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>CELODUELS</h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "#35D07F", fontSize: "0.9rem", marginTop: "0.5rem", fontWeight: 500 }}>Powered by Celo Mainnet</p>
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "1rem", marginTop: "0.75rem" }}>Minigames P2P · 100% Onchain · Sem Intermediários</p>
        </div>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          {["⚡ Sem servidor", "🔒 Commit-Reveal", "💰 Aposta livre"].map((f) => (
            <span key={f} style={{ color: "#4B5563", fontSize: "0.9rem", fontFamily: "DM Sans, sans-serif" }}>{f}</span>
          ))}
        </div>
        <button onClick={() => connect({ connector: injected() })}
          style={{ background: "linear-gradient(90deg, #35D07F, #2ab870)", color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.2rem", letterSpacing: "0.05em", padding: "1rem 3rem", borderRadius: "1rem", border: "none", cursor: "pointer", boxShadow: "0 0 30px #35D07F44" }}>
          CONECTAR CARTEIRA
        </button>
        <p style={{ fontFamily: "DM Sans, sans-serif", color: "#374151", fontSize: "0.8rem" }}>MetaMask · MiniPay · Qualquer carteira Web3</p>
      </main>
    );
  }

  // ─── SIDEBAR ──────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside style={{ width: sidebarOpen ? "260px" : "0", minWidth: sidebarOpen ? "260px" : "0", overflow: "hidden", transition: "all 0.3s ease", background: "#0A0D12", borderRight: "1px solid #1A2620", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1A2620" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #35D07F, #FBCC5C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>⚡</div>
          <div>
            <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "0.95rem" }}>Jogador</div>
            <div style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.72rem" }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {[{ label: "Vitórias", value: "0", color: "#35D07F" }, { label: "Derrotas", value: "0", color: "#EF4444" }].map((s) => (
            <div key={s.label} style={{ background: "#0F1117", borderRadius: "0.75rem", padding: "0.75rem", textAlign: "center", border: "1px solid #1F2937" }}>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.5rem", color: s.color }}>{s.value}</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.7rem", color: "#4B5563" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1A2620" }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#35D07F", fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>🏆 LEADERBOARD</div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid #1F293722" }}>
            <span style={{ fontFamily: "Rajdhani, sans-serif", color: "#FBCC5C", fontWeight: 700, width: "1.5rem", fontSize: "0.9rem" }}>#{i}</span>
            <div style={{ flex: 1, height: "6px", background: "#1F2937", borderRadius: "4px" }} />
          </div>
        ))}
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.7rem", color: "#374151", marginTop: "0.5rem" }}>Jogue para aparecer aqui</p>
      </div>

      <div style={{ padding: "1.5rem", flex: 1 }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#35D07F", fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>📜 HISTÓRICO</div>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "#374151" }}>Nenhuma partida ainda.</p>
      </div>

      <div style={{ padding: "1rem", borderTop: "1px solid #1A2620" }}>
        <a href={`https://celoscan.io/address/${CELODUELS_ADDRESS}`} target="_blank" rel="noreferrer"
          style={{ display: "block", textAlign: "center", fontFamily: "DM Sans, sans-serif", color: "#374151", fontSize: "0.75rem", textDecoration: "none", marginBottom: "0.75rem" }}>
          🔍 Contrato na Celo Mainnet ›
        </a>
        <button onClick={() => disconnect()}
          style={{ width: "100%", padding: "0.75rem", background: "#0F1117", border: "1px solid #1F2937", borderRadius: "0.75rem", color: "#6B7280", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", cursor: "pointer" }}>
          Desconectar
        </button>
      </div>
    </aside>
  );

  // ─── HEADER ───────────────────────────────────────────────────────
  const Header = () => (
    <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #1A2620", display: "flex", alignItems: "center", gap: "1rem", background: "#0A0D12", flexShrink: 0 }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#4B5563", fontSize: "1.2rem", cursor: "pointer" }}>☰</button>
      <h1 onClick={() => setScreen("dashboard")} style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "0.1em", background: "linear-gradient(90deg, #35D07F, #FBCC5C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, cursor: "pointer" }}>CELODUELS</h1>
      {screen !== "dashboard" && (
        <button onClick={() => setScreen("dashboard")} style={{ background: "none", border: "1px solid #1F2937", color: "#6B7280", padding: "0.35rem 0.875rem", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.82rem" }}>‹ Voltar</button>
      )}
      <div style={{ marginLeft: "auto", background: "#0F1117", border: "1px solid #FBCC5C33", borderRadius: "0.75rem", padding: "0.45rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "#FBCC5C", fontSize: "0.9rem" }}>💰</span>
        <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "0.95rem" }}>
          {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : "—"} CELO
        </span>
      </div>
    </header>
  );

  // ─── PLAYING SCREEN ───────────────────────────────────────────────
  if (screen === "playing") {
    const game = selectedGame ?? GAMES[0];
    const gState = activeGame ? Number(activeGame.state) : -1;
    const settled = gState === 3 || gState === 4;
    const stakeDisplay = activeGame ? formatEther(activeGame.stake) : stakeAmount;

    return (
      <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
        <style>{fonts}</style>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Header />
          <main style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto", width: "100%" }}>

            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>{game.emoji}</div>
              <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: "#F9FAFB", margin: 0 }}>{game.name.toUpperCase()}</h2>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                Duelo #{activeGameId} · <span style={{ color: game.color }}>🏆 Prêmio: {(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} CELO</span>
              </p>
            </div>

            <div style={{ background: "#0F1117", border: `1px solid ${statusColors[statusType]}33`, borderRadius: "1rem", padding: "2rem", textAlign: "center", marginBottom: "1.5rem" }}>
              {!settled && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
                  <div style={{ width: "44px", height: "44px", border: `3px solid ${game.color}`, borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                </div>
              )}
              {settled && (
                <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>
                  {statusType === "success" ? "🏆" : statusType === "error" ? "💀" : "🤝"}
                </div>
              )}
              <p style={{ fontFamily: settled ? "Rajdhani, sans-serif" : "DM Sans, sans-serif", fontWeight: settled ? 700 : 400, color: statusColors[statusType], fontSize: settled ? "1.5rem" : "1rem", margin: 0 }}>
                {status || "Aguardando..."}
              </p>
              {settled && statusType === "success" && (
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#35D07F", fontSize: "1rem", marginTop: "0.5rem" }}>
                  +{(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} CELO na sua carteira!
                </p>
              )}
            </div>

            {selectedMove && (
              <div style={{ background: "#0F1117", border: `1px solid ${game.color}22`, borderRadius: "0.875rem", padding: "1rem", textAlign: "center", marginBottom: "1rem" }}>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.72rem", margin: "0 0 0.4rem 0", letterSpacing: "0.08em" }}>SEU MOVE</p>
                <span style={{ fontSize: "1.75rem" }}>{game.moves.find((m) => m.value === selectedMove)?.emoji}</span>
                <span style={{ fontFamily: "Rajdhani, sans-serif", color: game.color, fontWeight: 700, marginLeft: "0.5rem", fontSize: "1rem" }}>{game.moves.find((m) => m.value === selectedMove)?.label}</span>
              </div>
            )}

            {settled && (
              <button onClick={() => setScreen("dashboard")}
                style={{ width: "100%", padding: "1rem", background: `linear-gradient(90deg, ${game.color}, ${game.color}CC)`, color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.1rem", borderRadius: "0.875rem", border: "none", cursor: "pointer", letterSpacing: "0.05em" }}>
                JOGAR NOVAMENTE
              </button>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ─── LOBBY SCREEN ─────────────────────────────────────────────────
  if (screen === "lobby") {
    return (
      <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
        <style>{fonts}</style>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Header />
          <main style={{ padding: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "2rem", color: "#F9FAFB", margin: 0 }}>PARTIDAS ABERTAS</h2>
              <button onClick={() => refetchGames()}
                style={{ background: "#0F1117", border: "1px solid #1F2937", color: "#6B7280", padding: "0.5rem 1rem", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                ↻ Atualizar
              </button>
            </div>

            {!openGames || (openGames as any[]).filter(g => g.player1.toLowerCase() !== address?.toLowerCase()).length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem" }}>
                <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</p>
                <p style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.2rem", color: "#4B5563" }}>Nenhuma partida aberta</p>
                <button onClick={() => setScreen("dashboard")}
                  style={{ marginTop: "1.5rem", background: "linear-gradient(90deg, #35D07F, #2ab870)", color: "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, padding: "0.75rem 2rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "1rem" }}>
                  CRIAR JOGO
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(openGames as any[])
                  .filter(g => g.player1.toLowerCase() !== address?.toLowerCase())
                  .map((g) => {
                    const gType = Number(g.gameType);
                    const color = GAME_TYPE_COLORS[gType];
                    const game = GAMES.find(x => x.type === gType);
                    const stakeDisplay = formatEther(g.stake);
                    return (
                      <div key={g.id.toString()} style={{ background: "#0F1117", border: `1px solid ${color}22`, borderRadius: "1rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontSize: "2rem" }}>{game?.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1rem" }}>{GAME_TYPE_NAMES[gType]}</div>
                          <div style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.8rem" }}>#{g.id.toString()} · {g.player1.slice(0, 6)}...{g.player1.slice(-4)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Rajdhani, sans-serif", color, fontWeight: 700 }}>{stakeDisplay} CELO</div>
                          <div style={{ fontFamily: "DM Sans, sans-serif", color: "#374151", fontSize: "0.75rem" }}>🏆 {(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} prêmio</div>
                        </div>
                        <button
                          onClick={() => {
                            const foundGame = GAMES.find(x => x.type === gType);
                            if (foundGame) { setSelectedGame(foundGame); setSelectedMove(null); setJoinGameId(g.id.toString()); setScreen("game"); }
                          }}
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

  // ─── GAME SCREEN ──────────────────────────────────────────────────
  if (screen === "game") {
    const game = selectedGame ?? GAMES[0];
    const isJoining = !!joinGameId;
    const isOddEven = game.type === GAME_TYPES.ODD_EVEN;
    const filteredMoves = isOddEven
      ? (isJoining ? game.moves.filter(m => m.value >= 3) : game.moves.filter(m => m.value <= 2))
      : game.moves;

    return (
      <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
        <style>{fonts}</style>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Header />
          <main style={{ padding: "2rem", maxWidth: "600px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
              <span style={{ fontSize: "2.5rem" }}>{game.emoji}</span>
              <div>
                <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: "#F9FAFB", margin: 0 }}>{game.name.toUpperCase()}</h2>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.85rem", margin: 0 }}>{game.description}</p>
              </div>
            </div>

            <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {isOddEven
                ? (isJoining ? "Você é o Player 2 — escolha um número de 3 a 10" : "Você é o Player 1 — escolha Par ou Ímpar")
                : (isJoining ? "Escolha seu move para entrar no duelo" : "Escolha seu move — será ocultado até o adversário entrar")}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              {filteredMoves.map((m) => (
                <button key={m.value} onClick={() => setSelectedMove(m.value)}
                  style={{ flex: "1", minWidth: "90px", padding: "1.25rem 0.75rem", borderRadius: "1rem", border: `2px solid ${selectedMove === m.value ? game.color : "#1F2937"}`, background: selectedMove === m.value ? `${game.color}18` : "#0F1117", cursor: "pointer", transition: "all 0.15s", boxShadow: selectedMove === m.value ? `0 0 20px ${game.color}33` : "none" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>{m.emoji}</div>
                  <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: selectedMove === m.value ? game.color : "#6B7280", fontSize: "0.9rem" }}>{m.label}</div>
                </button>
              ))}
            </div>

            {!isJoining && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ fontFamily: "DM Sans, sans-serif", color: "#6B7280", fontSize: "0.85rem", display: "block", marginBottom: "0.5rem" }}>Valor da aposta (CELO)</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  {["0.001", "0.01", "0.1", "1"].map((v) => (
                    <button key={v} onClick={() => setStakeAmount(v)}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: `1px solid ${stakeAmount === v ? game.color : "#1F2937"}`, background: stakeAmount === v ? `${game.color}18` : "#0F1117", color: stakeAmount === v ? game.color : "#4B5563", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
                      {v}
                    </button>
                  ))}
                </div>
                <input type="number" min="0.0001" max="10" step="0.0001"
                  value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
                  style={{ width: "100%", background: "#0F1117", border: `1px solid ${game.color}33`, borderRadius: "0.75rem", padding: "0.75rem 1rem", color: "#F9FAFB", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.1rem", outline: "none", textAlign: "center" }} />
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "#374151", fontSize: "0.75rem", marginTop: "0.4rem", textAlign: "center" }}>
                  Mín: 0.0001 · Máx: 10 CELO · 🏆 Prêmio: {(parseFloat(stakeAmount || "0") * 2 * 0.99).toFixed(4)} CELO
                </p>
              </div>
            )}

            {isJoining && (
              <div style={{ background: "#0F1117", border: `1px solid ${game.color}33`, borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.85rem" }}>Entrando no duelo</span>
                <span style={{ fontFamily: "Rajdhani, sans-serif", color: game.color, fontWeight: 700, fontSize: "1.2rem" }}>#{joinGameId}</span>
              </div>
            )}

            {!isJoining && (
              <input type="text" placeholder="Ou cole o Game ID para entrar num duelo existente"
                onChange={(e) => setJoinGameId(e.target.value)}
                style={{ width: "100%", background: "#0F1117", border: "1px solid #1F2937", borderRadius: "0.75rem", padding: "0.875rem 1rem", color: "#F9FAFB", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", marginBottom: "1rem", outline: "none" }} />
            )}

            <button disabled={loading || !selectedMove}
              onClick={() => isJoining ? handleJoin() : handleCreate()}
              style={{ width: "100%", padding: "1rem", borderRadius: "0.875rem", border: "none", cursor: loading || !selectedMove ? "not-allowed" : "pointer", background: loading || !selectedMove ? "#1F2937" : `linear-gradient(90deg, ${game.color}, ${game.color}CC)`, color: loading || !selectedMove ? "#374151" : "#0B0E14", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.05em", transition: "all 0.2s", boxShadow: loading || !selectedMove ? "none" : `0 0 30px ${game.color}33` }}>
              {loading ? "PROCESSANDO..." : isJoining ? `ENTRAR NO DUELO #${joinGameId}` : `CRIAR DUELO · ${stakeAmount} CELO`}
            </button>

            {status && (
              <div style={{ marginTop: "1rem", padding: "1rem", background: "#0F1117", border: `1px solid ${statusColors[statusType]}33`, borderRadius: "0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", color: statusColors[statusType] }}>
                {status}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#0B0E14", overflow: "hidden" }}>
      <style>{fonts}</style>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <Header />
        <main style={{ padding: "2rem", flex: 1 }}>
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "2.5rem", color: "#F9FAFB", margin: 0 }}>CRIAR NOVO DUELO</h2>
            <p style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", marginTop: "0.25rem", fontSize: "0.9rem" }}>
              Celo Mainnet · Taxa 1% · Commit-Reveal · Resultado 100% onchain
            </p>
          </div>

          <button onClick={() => { setScreen("lobby"); refetchGames(); }}
            style={{ width: "100%", marginBottom: "2rem", background: "linear-gradient(135deg, #0F1A14, #0F1117)", border: "1px solid #35D07F33", borderRadius: "1rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#35D07F18", border: "1px solid #35D07F33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>🎮</div>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#35D07F", fontSize: "1.1rem" }}>BUSCAR PARTIDA</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.82rem" }}>Entrar em um duelo existente</div>
            </div>
            <div style={{ background: "#35D07F18", border: "1px solid #35D07F33", borderRadius: "2rem", padding: "0.25rem 0.875rem", fontFamily: "Rajdhani, sans-serif", color: "#35D07F", fontWeight: 700, fontSize: "0.9rem" }}>
              {openCount} aberto{openCount !== 1 ? "s" : ""}
            </div>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            {GAMES.map((game) => (
              <button key={game.type} onClick={() => goToGame(game)}
                style={{ background: `linear-gradient(135deg, ${game.colorDim}, #0F1117)`, border: `1px solid ${game.color}33`, borderRadius: "1rem", padding: "1.5rem", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = `0 0 30px ${game.color}22`; e.currentTarget.style.borderColor = `${game.color}66`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = `${game.color}33`; }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{game.emoji}</div>
                <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: "#F9FAFB", fontSize: "1.05rem", marginBottom: "0.25rem" }}>{game.name}</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", color: "#4B5563", fontSize: "0.8rem", marginBottom: "1rem" }}>{game.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Rajdhani, sans-serif", color: game.color, fontWeight: 700, fontSize: "0.85rem" }}>Aposta livre</span>
                  <span style={{ color: game.color }}>›</span>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}