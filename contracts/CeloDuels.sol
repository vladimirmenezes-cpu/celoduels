// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CeloDuelsMulti {
    address public immutable feeRecipient;

    uint256 public constant STAKE = 0.001 ether;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant TIMEOUT = 24 hours;

    enum GameType { RPS, COIN_FLIP, ODD_EVEN, DILEMMA }
    enum GameState { CREATED, JOINED, REVEALING, SETTLED, CANCELLED }

    struct Game {
        address payable player1;
        address payable player2;
        bytes32 hash1;
        bytes32 hash2;
        uint8 move1;
        uint8 move2;
        GameState state;
        GameType gameType;
        uint256 joinedAt;
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed player1, GameType gameType);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event GameSettled(uint256 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(uint256 indexed gameId);

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    function createGame(bytes32 _hash, GameType _gameType) external payable returns (uint256) {
        require(msg.value == STAKE, "Must send exactly 0.001 CELO");

        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            player1:  payable(msg.sender),
            player2:  payable(address(0)),
            hash1:    _hash,
            hash2:    bytes32(0),
            move1:    0,
            move2:    0,
            state:    GameState.CREATED,
            gameType: _gameType,
            joinedAt: 0
        });

        emit GameCreated(gameId, msg.sender, _gameType);
        return gameId;
    }

    function joinGame(uint256 _gameId, bytes32 _hash) external payable {
        Game storage g = games[_gameId];
        require(g.state == GameState.CREATED, "Game not open");
        require(msg.sender != g.player1, "Cannot play yourself");
        require(msg.value == STAKE, "Must send exactly 0.001 CELO");

        g.player2  = payable(msg.sender);
        g.hash2    = _hash;
        g.state    = GameState.JOINED;
        g.joinedAt = block.timestamp;

        emit GameJoined(_gameId, msg.sender);
    }

    function revealMove(uint256 _gameId, uint8 _move, string calldata _salt) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.JOINED || g.state == GameState.REVEALING, "Wrong state");

        bytes32 expected = keccak256(abi.encodePacked(_move, _salt));

        if (msg.sender == g.player1) {
            require(g.move1 == 0, "Already revealed");
            require(expected == g.hash1, "Hash mismatch");
            g.move1 = _move;
        } else if (msg.sender == g.player2) {
            require(g.move2 == 0, "Already revealed");
            require(expected == g.hash2, "Hash mismatch");
            g.move2 = _move;
        } else {
            revert("Not a player");
        }

        g.state = GameState.REVEALING;

        if (g.move1 != 0 && g.move2 != 0) {
            _settle(_gameId);
        }
    }

    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.JOINED || g.state == GameState.REVEALING, "Wrong state");
        require(block.timestamp >= g.joinedAt + TIMEOUT, "Timeout not reached");

        g.state = GameState.CANCELLED;

        if (g.move1 != 0 && g.move2 == 0) {
            g.player1.transfer(STAKE * 2);
        } else if (g.move2 != 0 && g.move1 == 0) {
            g.player2.transfer(STAKE * 2);
        } else {
            g.player1.transfer(STAKE);
            g.player2.transfer(STAKE);
        }

        emit GameCancelled(_gameId);
    }

    function _settle(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        g.state = GameState.SETTLED;

        address winner = _determineWinner(g);
        uint256 pot   = STAKE * 2;
        uint256 fee   = (pot * FEE_BPS) / 10000;
        uint256 prize = pot - fee;

        if (winner == address(0)) {
            g.player1.transfer(STAKE);
            g.player2.transfer(STAKE);
        } else {
            payable(feeRecipient).transfer(fee);
            payable(winner).transfer(prize);
        }

        emit GameSettled(_gameId, winner, prize);
    }

    function _determineWinner(Game storage g) internal view returns (address) {
        uint8 m1 = g.move1;
        uint8 m2 = g.move2;

        if (g.gameType == GameType.RPS) {
            // 1=Pedra 2=Papel 3=Tesoura
            if (m1 == m2) return address(0);
            if (
                (m1 == 1 && m2 == 3) ||
                (m1 == 2 && m2 == 1) ||
                (m1 == 3 && m2 == 2)
            ) return g.player1;
            return g.player2;
        }

        if (g.gameType == GameType.COIN_FLIP) {
            // 1=Cara 2=Coroa — quem acertar a mesma escolha que o oponente NÃO ganha
            // Player1 escolhe, Player2 também escolhe — se igual empata, senão sorteia pelo hash
            if (m1 == m2) return address(0);
            // Desempate deterministico pelo XOR dos hashes
            uint256 rand = uint256(g.hash1 ^ g.hash2);
            return rand % 2 == 0 ? g.player1 : g.player2;
        }

        if (g.gameType == GameType.ODD_EVEN) {
            // Player1 escolhe PAR(1) ou IMPAR(2)
            // Player2 escolhe um numero de 1 a 10
            // A soma dos dois moves determina par ou impar
            uint8 sum = m1 + m2;
            bool isEven = sum % 2 == 0;
            // Player1 apostou PAR=1, IMPAR=2
            if (isEven && g.move1 == 1) return g.player1;
            if (!isEven && g.move1 == 2) return g.player1;
            return g.player2;
        }

        if (g.gameType == GameType.DILEMMA) {
            // Dilema do Prisioneiro
            // 1=Cooperar 2=Trair
            // Ambos cooperam = empate (dividem)
            // Ambos traem = empate (dividem)
            // Um trai e outro coopera = quem trai ganha tudo
            if (m1 == m2) return address(0);
            if (m1 == 2) return g.player1; // P1 traiu
            return g.player2;              // P2 traiu
        }

        return address(0);
    }

    function getGame(uint256 _gameId) external view returns (Game memory) {
        return games[_gameId];
    }
}