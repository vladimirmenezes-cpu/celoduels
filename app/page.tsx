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
    color: "var(--game-rps)",
    description: "O clássico. Sem trapaça possível.",
    moves: [{ value: 1, label: "Pedra", emoji: "✊" }, { value: 2, label: "Papel", emoji: "✋" }, { value: 3, label: "Tesoura", emoji: "✌️" }],
  },
  {
    type: GAME_TYPES.COIN_FLIP, name: "Cara ou Coroa", short: "Coin", emoji: "🪙",
    color: "var(--game-coin)",
    description: "50/50. Sorte pura, verificada onchain.",
    moves: [{ value: 1, label: "Cara", emoji: "👑" }, { value: 2, label: "Coroa", emoji: "🔵" }],
  },
  {
    type: GAME_TYPES.ODD_EVEN, name: "Par ou Ímpar", short: "P/I", emoji: "🔢",
    color: "var(--game-oddeven)",
    description: "Escolha Par ou Ímpar — a soma decide.",
    moves: [{ value: 1, label: "Par", emoji: "2️⃣" }, { value: 2, label: "Ímpar", emoji: "1️⃣" },
      { value: 3, label: "3", emoji: "3️⃣" }, { value: 4, label: "4", emoji: "4️⃣" },
      { value: 5, label: "5", emoji: "5️⃣" }, { value: 6, label: "6", emoji: "6️⃣" },
      { value: 7, label: "7", emoji: "7️⃣" }, { value: 8, label: "8", emoji: "8️⃣" },
      { value: 9, label: "9", emoji: "9️⃣" }, { value: 10, label: "10", emoji: "🔟" }],
  },
  {
    type: GAME_TYPES.DILEMMA, name: "Dilema do Prisioneiro", short: "Dilema", emoji: "🔒",
    color: "var(--game-dilemma)",
    description: "Cooperar ou trair? A blockchain decide.",
    moves: [{ value: 1, label: "Cooperar", emoji: "🤝" }, { value: 2, label: "Trair", emoji: "🗡️" }],
  },
];

const GAME_TYPE_NAMES: Record<number, string> = { 0: "RPS", 1: "Coin Flip", 2: "Par/Ímpar", 3: "Dilema" };
const GAME_TYPE_COLORS: Record<number, string> = { 0: "var(--game-rps)", 1: "var(--game-coin)", 2: "var(--game-oddeven)", 3: "var(--game-dilemma)" };
type Screen = "dashboard" | "lobby" | "game" | "playing";

/** Botão base — cuida de estado disabled, feedback de press e foco visível num só lugar. */
function Button({
  children, onClick, disabled, variant = "solid", accent = "var(--brand)", className = "",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "solid" | "outline" | "ghost"; accent?: string; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-wide transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: disabled ? "var(--border)" : accent, color: disabled ? "var(--ink-faint)" : "var(--brand-ink)", boxShadow: disabled ? "none" : `0 8px 24px -8px color-mix(in srgb, ${accent} 55%, transparent)` },
    outline: { background: "transparent", border: `1px solid ${accent}`, color: accent },
    ghost: { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-muted)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${className}`} style={{ ...styles[variant], outlineColor: accent }}>
      {children}
    </button>
  );
}

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
  const statusColors = { info: "var(--ink-muted)", success: "var(--success)", error: "var(--danger)", warning: "var(--warning)" };

  // ─── CONNECT ──────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-10 px-8 py-12 text-center"
        style={{ background: "radial-gradient(120% 100% at 50% -10%, #1a1610 0%, var(--bg) 55%)" }}
      >
        <div>
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
            style={{ background: "var(--brand)", boxShadow: "0 0 48px -8px var(--brand)" }}
          >
            ⚡
          </div>
          <h1 className="font-display text-5xl font-bold tracking-wide text-ink sm:text-6xl">
            CELODUELS
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--brand)" }}>
            Powered by Celo Mainnet
          </p>
          <p className="mt-3 text-base text-ink-muted">
            Minigames P2P · 100% onchain · sem intermediários
          </p>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-ink-faint">
          <li>Sem servidor</li>
          <li>Commit-reveal</li>
          <li>Aposta livre</li>
        </ul>

        <Button onClick={() => connect({ connector: injected() })} className="px-10 py-4 text-lg">
          Conectar carteira
        </Button>

        <p className="text-xs text-ink-faint">MetaMask · MiniPay · qualquer carteira Web3</p>
      </main>
    );
  }

  // ─── SIDEBAR ──────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside
      className="flex flex-col overflow-hidden border-r border-border bg-sunken transition-[width] duration-300 ease-out"
      style={{ width: sidebarOpen ? "260px" : "0px" }}
    >
      <div className="w-[260px] shrink-0 border-b border-border p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: "var(--brand)" }}
          >
            ⚡
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-ink">Jogador</div>
            <div className="truncate text-xs text-ink-faint">{address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[{ label: "Vitórias", value: "0", color: "var(--success)" }, { label: "Derrotas", value: "0", color: "var(--danger)" }].map((s) => (
            <div key={s.label} className="rounded-xl border border-border-soft bg-surface p-3 text-center">
              <div className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[0.7rem] text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[260px] shrink-0 border-b border-border p-6">
        <div className="mb-3 font-display text-xs font-bold tracking-widest" style={{ color: "var(--brand)" }}>
          🏆 LEADERBOARD
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border-soft py-2 last:border-0">
            <span className="w-6 font-display text-sm font-bold" style={{ color: "var(--brand)" }}>#{i}</span>
            <div className="h-1.5 flex-1 rounded-full bg-border" />
          </div>
        ))}
        <p className="mt-2 text-xs text-ink-faint">Jogue para aparecer aqui</p>
      </div>

      <div className="w-[260px] shrink-0 flex-1 overflow-y-auto p-6 thin-scroll">
        <div className="mb-3 font-display text-xs font-bold tracking-widest" style={{ color: "var(--brand)" }}>
          📜 HISTÓRICO
        </div>
        <p className="text-sm text-ink-faint">Nenhuma partida ainda.</p>
      </div>

      <div className="w-[260px] shrink-0 border-t border-border p-4">
        <a
          href={`https://celoscan.io/address/${CELODUELS_ADDRESS}`}
          target="_blank" rel="noreferrer"
          className="mb-3 block text-center text-xs text-ink-faint hover:text-ink-muted"
        >
          🔍 Contrato na Celo Mainnet ›
        </a>
        <Button onClick={() => disconnect()} variant="ghost" className="w-full py-3 text-sm">
          Desconectar
        </Button>
      </div>
    </aside>
  );

  // ─── HEADER ───────────────────────────────────────────────────────
  const Header = () => (
    <header className="flex shrink-0 items-center gap-4 border-b border-border bg-sunken px-6 py-4">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Alternar menu"
        className="text-lg text-ink-faint transition-colors hover:text-ink-muted"
      >
        ☰
      </button>
      <h1
        onClick={() => setScreen("dashboard")}
        className="cursor-pointer font-display text-xl font-bold tracking-wide text-ink"
      >
        CELODUELS
      </h1>
      {screen !== "dashboard" && (
        <Button onClick={() => setScreen("dashboard")} variant="ghost" className="px-3.5 py-1.5 text-sm">
          ‹ Voltar
        </Button>
      )}
      <div
        className="ml-auto flex items-center gap-2 rounded-xl border px-4 py-2"
        style={{ background: "var(--surface)", borderColor: "color-mix(in srgb, var(--brand) 30%, transparent)" }}
      >
        <span className="text-sm" style={{ color: "var(--brand)" }}>💰</span>
        <span className="font-display text-sm font-bold text-ink">
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
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-auto">
          <Header />
          <main className="mx-auto w-full max-w-[560px] p-8">
            <div className="mb-8 text-center">
              <div className="mb-2 text-6xl">{game.emoji}</div>
              <h2 className="font-display text-3xl font-bold text-ink">{game.name.toUpperCase()}</h2>
              <p className="mt-1 text-sm text-ink-faint">
                Duelo #{activeGameId} · <span style={{ color: game.color }}>🏆 Prêmio: {(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} CELO</span>
              </p>
            </div>

            <div
              className="mb-6 rounded-2xl border p-8 text-center"
              style={{ background: "var(--surface)", borderColor: `color-mix(in srgb, ${statusColors[statusType]} 25%, transparent)` }}
            >
              {!settled && (
                <div className="mb-5 flex justify-center">
                  <div
                    className="h-11 w-11 animate-spin-slow rounded-full border-[3px] border-transparent"
                    style={{ borderTopColor: game.color, borderRightColor: game.color }}
                  />
                </div>
              )}
              {settled && (
                <div className="animate-reveal mb-3 text-5xl">
                  {statusType === "success" ? "🏆" : statusType === "error" ? "💀" : "🤝"}
                </div>
              )}
              <p
                className={settled ? "font-display text-2xl font-bold" : "text-base"}
                style={{ color: statusColors[statusType] }}
              >
                {status || "Aguardando..."}
              </p>
              {settled && statusType === "success" && (
                <p className="mt-2 text-base" style={{ color: "var(--success)" }}>
                  +{(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} CELO na sua carteira!
                </p>
              )}
            </div>

            {selectedMove && (
              <div className="mb-4 rounded-xl border border-border-soft bg-surface p-4 text-center">
                <p className="mb-1 text-xs tracking-wide text-ink-faint">SEU MOVE</p>
                <span className="text-3xl">{game.moves.find((m) => m.value === selectedMove)?.emoji}</span>
                <span className="ml-2 font-display text-base font-bold" style={{ color: game.color }}>
                  {game.moves.find((m) => m.value === selectedMove)?.label}
                </span>
              </div>
            )}

            {settled && (
              <Button onClick={() => setScreen("dashboard")} accent={game.color} className="w-full py-4 text-lg">
                Jogar novamente
              </Button>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ─── LOBBY SCREEN ─────────────────────────────────────────────────
  if (screen === "lobby") {
    const openList = (openGames as any[] | undefined)?.filter((g) => g.player1.toLowerCase() !== address?.toLowerCase()) ?? [];

    return (
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-auto">
          <Header />
          <main className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-3xl font-bold text-ink">PARTIDAS ABERTAS</h2>
              <Button onClick={() => refetchGames()} variant="ghost" className="px-4 py-2 text-sm">
                ↻ Atualizar
              </Button>
            </div>

            {openList.length === 0 ? (
              <div className="py-16 text-center">
                <p className="mb-4 text-5xl">🎯</p>
                <p className="font-display text-lg text-ink-faint">Nenhuma partida aberta</p>
                <Button onClick={() => setScreen("dashboard")} className="mt-6 px-8 py-3">
                  Criar jogo
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {openList.map((g) => {
                  const gType = Number(g.gameType);
                  const color = GAME_TYPE_COLORS[gType];
                  const game = GAMES.find((x) => x.type === gType);
                  const stakeDisplay = formatEther(g.stake);
                  return (
                    <div
                      key={g.id.toString()}
                      className="hoverable flex items-center gap-4 rounded-2xl border p-5"
                      style={{ background: "var(--surface)", borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
                    >
                      <span className="text-3xl">{game?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-base font-bold text-ink">{GAME_TYPE_NAMES[gType]}</div>
                        <div className="truncate text-sm text-ink-faint">
                          #{g.id.toString()} · {g.player1.slice(0, 6)}...{g.player1.slice(-4)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold" style={{ color }}>{stakeDisplay} CELO</div>
                        <div className="text-xs text-ink-faint">🏆 {(parseFloat(stakeDisplay) * 2 * 0.99).toFixed(4)} prêmio</div>
                      </div>
                      <Button
                        accent={color}
                        onClick={() => {
                          const foundGame = GAMES.find((x) => x.type === gType);
                          if (foundGame) { setSelectedGame(foundGame); setSelectedMove(null); setJoinGameId(g.id.toString()); setScreen("game"); }
                        }}
                        className="px-6 py-2.5 text-sm"
                      >
                        Entrar
                      </Button>
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
      ? (isJoining ? game.moves.filter((m) => m.value >= 3) : game.moves.filter((m) => m.value <= 2))
      : game.moves;

    return (
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-auto">
          <Header />
          <main className="max-w-[600px] p-8">
            <div className="mb-8 flex items-center gap-4">
              <span className="text-4xl">{game.emoji}</span>
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">{game.name.toUpperCase()}</h2>
                <p className="text-sm text-ink-faint">{game.description}</p>
              </div>
            </div>

            <p className="mb-4 text-sm text-ink-muted">
              {isOddEven
                ? (isJoining ? "Você é o Player 2 — escolha um número de 3 a 10" : "Você é o Player 1 — escolha Par ou Ímpar")
                : (isJoining ? "Escolha seu move para entrar no duelo" : "Escolha seu move — será ocultado até o adversário entrar")}
            </p>

            <div className="mb-6 flex flex-wrap gap-3">
              {filteredMoves.map((m) => {
                const active = selectedMove === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMove(m.value)}
                    className="min-w-[90px] flex-1 rounded-2xl border-2 p-5 text-center transition-[border-color,background-color,box-shadow] duration-150 ease-out active:scale-[0.97]"
                    style={{
                      borderColor: active ? game.color : "var(--border)",
                      background: active ? `color-mix(in srgb, ${game.color} 10%, var(--surface))` : "var(--surface)",
                      boxShadow: active ? `0 0 20px -4px color-mix(in srgb, ${game.color} 50%, transparent)` : "none",
                    }}
                  >
                    <div className="mb-1.5 text-3xl">{m.emoji}</div>
                    <div className="font-display text-sm font-bold" style={{ color: active ? game.color : "var(--ink-muted)" }}>
                      {m.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {!isJoining && (
              <div className="mb-6">
                <label className="mb-2 block text-sm text-ink-muted">Valor da aposta (CELO)</label>
                <div className="mb-2 flex gap-2">
                  {["0.001", "0.01", "0.1", "1"].map((v) => {
                    const active = stakeAmount === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setStakeAmount(v)}
                        className="flex-1 rounded-lg border py-2 font-display text-sm font-bold transition-colors duration-150 active:scale-[0.97]"
                        style={{
                          borderColor: active ? game.color : "var(--border)",
                          background: active ? `color-mix(in srgb, ${game.color} 10%, var(--surface))` : "var(--surface)",
                          color: active ? game.color : "var(--ink-faint)",
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number" min="0.0001" max="10" step="0.0001"
                  value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
                  className="w-full rounded-xl border bg-surface px-4 py-3 text-center font-display text-lg font-bold text-ink outline-none"
                  style={{ borderColor: `color-mix(in srgb, ${game.color} 30%, transparent)` }}
                />
                <p className="mt-1.5 text-center text-xs text-ink-faint">
                  Mín: 0.0001 · Máx: 10 CELO · 🏆 Prêmio: {(parseFloat(stakeAmount || "0") * 2 * 0.99).toFixed(4)} CELO
                </p>
              </div>
            )}

            {isJoining && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: `color-mix(in srgb, ${game.color} 30%, transparent)` }}>
                <span className="text-sm text-ink-faint">Entrando no duelo</span>
                <span className="font-display text-xl font-bold" style={{ color: game.color }}>#{joinGameId}</span>
              </div>
            )}

            {!isJoining && (
              <input
                type="text" placeholder="Ou cole o Game ID para entrar num duelo existente"
                onChange={(e) => setJoinGameId(e.target.value)}
                className="mb-4 w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            )}

            <Button
              disabled={loading || !selectedMove}
              onClick={() => (isJoining ? handleJoin() : handleCreate())}
              accent={game.color}
              className="w-full py-4 text-lg"
            >
              {loading ? "Processando..." : isJoining ? `Entrar no duelo #${joinGameId}` : `Criar duelo · ${stakeAmount} CELO`}
            </Button>

            {status && (
              <div
                className="mt-4 rounded-xl border p-4 text-sm"
                style={{ background: "var(--surface)", borderColor: `color-mix(in srgb, ${statusColors[statusType]} 30%, transparent)`, color: statusColors[statusType] }}
              >
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
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <Header />
        <main className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="font-display text-4xl font-bold text-ink">CRIAR NOVO DUELO</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Celo Mainnet · Taxa 1% · Commit-reveal · Resultado 100% onchain
            </p>
          </div>

          <button
            onClick={() => { setScreen("lobby"); refetchGames(); }}
            className="hoverable mb-8 flex w-full items-center gap-4 rounded-2xl border p-6 text-left active:scale-[0.99]"
            style={{ background: "var(--surface)", borderColor: "color-mix(in srgb, var(--brand) 25%, transparent)" }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)" }}
            >
              🎮
            </div>
            <div className="flex-1">
              <div className="font-display text-lg font-bold" style={{ color: "var(--brand)" }}>Buscar partida</div>
              <div className="text-sm text-ink-faint">Entrar em um duelo existente</div>
            </div>
            <div
              className="rounded-full px-3.5 py-1 font-display text-sm font-bold"
              style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)", color: "var(--brand)" }}
            >
              {openCount} aberto{openCount !== 1 ? "s" : ""}
            </div>
          </button>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GAMES.map((game) => (
              <button
                key={game.type}
                onClick={() => goToGame(game)}
                className="hoverable rounded-2xl border p-6 text-left active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${game.color} 10%, transparent), var(--surface))`,
                  borderColor: `color-mix(in srgb, ${game.color} 20%, transparent)`,
                }}
              >
                <div className="mb-3 text-4xl">{game.emoji}</div>
                <div className="mb-1 font-display text-lg font-bold text-ink">{game.name}</div>
                <div className="mb-4 text-sm text-ink-faint">{game.description}</div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold" style={{ color: game.color }}>Aposta livre</span>
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