// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CeloDuelsMulti {
    address public immutable feeRecipient;

    uint256 public constant MIN_STAKE = 0.0001 ether;
    uint256 public constant MAX_STAKE = 10 ether;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant TIMEOUT = 24 hours;

    enum GameType  { RPS, COIN_FLIP, ODD_EVEN, DILEMMA }
    enum GameState { CREATED, JOINED, REVEALING, SETTLED, CANCELLED }

    struct Game {
        address payable player1;
        address payable player2;
        bytes32 hash1;
        bytes32 hash2;
        uint8   move1;
        uint8   move2;
        GameState state;
        GameType  gameType;
        uint256 joinedAt;
        uint256 createdAt;
        uint256 stake;
        uint8 wins1;
        uint8 wins2;
        uint8 draws;
        uint8 round;
        bool  bestOf3;
    }

    struct GameView {
        uint256   id;
        address   player1;
        GameType  gameType;
        GameState state;
        uint256   createdAt;
        uint256   stake;
        bool      bestOf3;
    }

    mapping(uint256 => Game) public games;
    uint256[] public openGameIds;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed player1, GameType gameType, uint256 stake);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event RoundSettled(uint256 indexed gameId, address indexed winner, uint8 round);
    event GameSettled(uint256 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(uint256 indexed gameId);

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    function createGame(bytes32 _hash, GameType _gameType, bool _bestOf3) external payable returns (uint256) {
        require(msg.value >= MIN_STAKE && msg.value <= MAX_STAKE, "Stake out of range");

        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            player1:   payable(msg.sender),
            player2:   payable(address(0)),
            hash1:     _hash,
            hash2:     bytes32(0),
            move1:     0,
            move2:     0,
            state:     GameState.CREATED,
            gameType:  _gameType,
            joinedAt:  0,
            createdAt: block.timestamp,
            stake:     msg.value,
            wins1:     0,
            wins2:     0,
            draws:     0,
            round:     1,
            bestOf3:   _bestOf3
        });

        openGameIds.push(gameId);
        emit GameCreated(gameId, msg.sender, _gameType, msg.value);
        return gameId;
    }

    function joinGame(uint256 _gameId, bytes32 _hash) external payable {
        Game storage g = games[_gameId];
        require(g.state == GameState.CREATED, "Game not open");
        require(msg.sender != g.player1, "Cannot play yourself");
        require(msg.value == g.stake, "Must match creator stake");

        g.player2  = payable(msg.sender);
        g.hash2    = _hash;
        g.state    = GameState.JOINED;
        g.joinedAt = block.timestamp;

        _removeFromOpenGames(_gameId);
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
            _settleRound(_gameId);
        }
    }

    function submitNextRound(uint256 _gameId, bytes32 _hash) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.CREATED && g.round > 1, "Not in next round");
        require(msg.sender == g.player1 || msg.sender == g.player2, "Not a player");

        if (msg.sender == g.player1) {
            require(g.hash1 == bytes32(0), "Already submitted");
            g.hash1 = _hash;
        } else {
            require(g.hash2 == bytes32(0), "Already submitted");
            g.hash2 = _hash;
        }

        if (g.hash1 != bytes32(0) && g.hash2 != bytes32(0)) {
            g.state = GameState.JOINED;
            _removeFromOpenGames(_gameId);
        }
    }

    function cancelGame(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.CREATED && g.round == 1, "Cannot cancel");
        require(msg.sender == g.player1, "Not your game");
        g.state = GameState.CANCELLED;
        _removeFromOpenGames(_gameId);
        g.player1.transfer(g.stake);
        emit GameCancelled(_gameId);
    }

    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.JOINED || g.state == GameState.REVEALING, "Wrong state");
        require(block.timestamp >= g.joinedAt + TIMEOUT, "Timeout not reached");
        g.state = GameState.CANCELLED;
        if (g.move1 != 0 && g.move2 == 0) {
            g.player1.transfer(g.stake * 2);
        } else if (g.move2 != 0 && g.move1 == 0) {
            g.player2.transfer(g.stake * 2);
        } else {
            g.player1.transfer(g.stake);
            g.player2.transfer(g.stake);
        }
        emit GameCancelled(_gameId);
    }

    function getOpenGames() external view returns (GameView[] memory) {
        uint256 count = openGameIds.length;
        GameView[] memory result = new GameView[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 id = openGameIds[i];
            Game storage g = games[id];
            result[i] = GameView({ id: id, player1: g.player1, gameType: g.gameType, state: g.state, createdAt: g.createdAt, stake: g.stake, bestOf3: g.bestOf3 });
        }
        return result;
    }

    function getGame(uint256 _gameId) external view returns (Game memory) {
        return games[_gameId];
    }

    function _settleRound(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        address roundWinner = _determineWinner(g);

        if (roundWinner == address(0)) g.draws++;
        else if (roundWinner == g.player1) g.wins1++;
        else g.wins2++;

        emit RoundSettled(_gameId, roundWinner, g.round);

        bool p1Won = g.wins1 >= 2 || (!g.bestOf3 && g.wins1 >= 1);
        bool p2Won = g.wins2 >= 2 || (!g.bestOf3 && g.wins2 >= 1);
        bool isDraw = !g.bestOf3 && g.draws >= 1;
        bool maxRounds = g.round >= 3;

        if (p1Won || p2Won || isDraw || maxRounds) {
            _finalSettle(_gameId);
        } else {
            g.round++;
            g.move1 = 0;
            g.move2 = 0;
            g.hash1 = bytes32(0);
            g.hash2 = bytes32(0);
            g.state = GameState.CREATED;
            openGameIds.push(_gameId);
        }
    }

    function _finalSettle(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        g.state = GameState.SETTLED;

        address winner;
        if (g.wins1 > g.wins2) winner = g.player1;
        else if (g.wins2 > g.wins1) winner = g.player2;
        else winner = address(0);

        uint256 pot   = g.stake * 2;
        uint256 fee   = (pot * FEE_BPS) / 10000;
        uint256 prize = pot - fee;

        if (winner == address(0)) {
            g.player1.transfer(g.stake);
            g.player2.transfer(g.stake);
        } else {
            payable(feeRecipient).transfer(fee);
            payable(winner).transfer(prize);
        }

        emit GameSettled(_gameId, winner, prize);
    }

    function _removeFromOpenGames(uint256 _gameId) internal {
        uint256 len = openGameIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (openGameIds[i] == _gameId) {
                openGameIds[i] = openGameIds[len - 1];
                openGameIds.pop();
                break;
            }
        }
    }

    function _determineWinner(Game storage g) internal view returns (address) {
        uint8 m1 = g.move1;
        uint8 m2 = g.move2;

        if (g.gameType == GameType.RPS) {
            if (m1 == m2) return address(0);
            if ((m1 == 1 && m2 == 3) || (m1 == 2 && m2 == 1) || (m1 == 3 && m2 == 2)) return g.player1;
            return g.player2;
        }
        if (g.gameType == GameType.COIN_FLIP) {
            if (m1 == m2) return address(0);
            uint256 rand = uint256(g.hash1 ^ g.hash2);
            return rand % 2 == 0 ? g.player1 : g.player2;
        }
        if (g.gameType == GameType.ODD_EVEN) {
            uint8 sum = m1 + m2;
            bool sumIsEven = sum % 2 == 0;
            bool p1ChoseEven = m1 == 1;
            bool p2ChoseEven = m2 == 1;
            if (p1ChoseEven == sumIsEven && p2ChoseEven == sumIsEven) return address(0);
            if (p1ChoseEven == sumIsEven) return g.player1;
            if (p2ChoseEven == sumIsEven) return g.player2;
            return address(0);
        }
        if (g.gameType == GameType.DILEMMA) {
            if (m1 == m2) return address(0);
            if (m1 == 2) return g.player1;
            return g.player2;
        }
        return address(0);
    }
}