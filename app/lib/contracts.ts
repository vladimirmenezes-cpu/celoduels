export const CELODUELS_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export type GameType = 0 | 1 | 2 | 3;

export const GAME_TYPES = {
  RPS: 0,
  COIN_FLIP: 1,
  ODD_EVEN: 2,
  DILEMMA: 3,
} as const;

export const CELODUELS_ABI = [
  {
    name: "createGame",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_hash", type: "bytes32" },
      { name: "_gameType", type: "uint8" },
      { name: "_bestOf3", type: "bool" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "joinGame",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_gameId", type: "uint256" },
      { name: "_hash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "revealMove",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_gameId", type: "uint256" },
      { name: "_move", type: "uint8" },
      { name: "_salt", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "submitNextRound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_gameId", type: "uint256" },
      { name: "_hash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "cancelGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimTimeout",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getOpenGames",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "player1", type: "address" },
          { name: "gameType", type: "uint8" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "stake", type: "uint256" },
          { name: "bestOf3", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "player1", type: "address" },
          { name: "player2", type: "address" },
          { name: "hash1", type: "bytes32" },
          { name: "hash2", type: "bytes32" },
          { name: "move1", type: "uint8" },
          { name: "move2", type: "uint8" },
          { name: "state", type: "uint8" },
          { name: "gameType", type: "uint8" },
          { name: "joinedAt", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "stake", type: "uint256" },
          { name: "wins1", type: "uint8" },
          { name: "wins2", type: "uint8" },
          { name: "draws", type: "uint8" },
          { name: "round", type: "uint8" },
          { name: "bestOf3", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player1", type: "address", indexed: true },
      { name: "gameType", type: "uint8", indexed: false },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
  {
    name: "GameSettled",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
] as const;