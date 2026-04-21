// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CeloDuels {
    address public immutable feeRecipient;

    uint256 public constant STAKE = 0.001 ether;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant TIMEOUT = 24 hours;

    enum GameState { CREATED, JOINED, REVEALING, SETTLED, CANCELLED }
    enum Move { NONE, ROCK, PAPER, SCISSORS }

    struct Game {
        address payable player1;
        address payable player2;
        bytes32 hash1;
        bytes32 hash2;
        Move move1;
        Move move2;
        GameState state;
        uint256 joinedAt;
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed player1);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event MoveRevealed(uint256 indexed gameId, address indexed player, Move move);
    event GameSettled(uint256 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(uint256 indexed gameId);

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    function createGame(bytes32 _hash) external payable returns (uint256) {
        require(msg.value == STAKE, "Must send exactly 0.001 CELO");

        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            player1:  payable(msg.sender),
            player2:  payable(address(0)),
            hash1:    _hash,
            hash2:    bytes32(0),
            move1:    Move.NONE,
            move2:    Move.NONE,
            state:    GameState.CREATED,
            joinedAt: 0
        });

        emit GameCreated(gameId, msg.sender);
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

    function revealMove(uint256 _gameId, Move _move, string calldata _salt) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.JOINED || g.state == GameState.REVEALING, "Wrong state");
        require(_move != Move.NONE, "Invalid move");

        bytes32 expected = keccak256(abi.encodePacked(_move, _salt));

        if (msg.sender == g.player1) {
            require(g.move1 == Move.NONE, "Already revealed");
            require(expected == g.hash1, "Hash mismatch");
            g.move1 = _move;
        } else if (msg.sender == g.player2) {
            require(g.move2 == Move.NONE, "Already revealed");
            require(expected == g.hash2, "Hash mismatch");
            g.move2 = _move;
        } else {
            revert("Not a player");
        }

        emit MoveRevealed(_gameId, msg.sender, _move);
        g.state = GameState.REVEALING;

        if (g.move1 != Move.NONE && g.move2 != Move.NONE) {
            _settle(_gameId);
        }
    }

    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(g.state == GameState.JOINED || g.state == GameState.REVEALING, "Wrong state");
        require(block.timestamp >= g.joinedAt + TIMEOUT, "Timeout not reached");

        g.state = GameState.CANCELLED;

        if (g.move1 != Move.NONE && g.move2 == Move.NONE) {
            g.player1.transfer(STAKE * 2);
        } else if (g.move2 != Move.NONE && g.move1 == Move.NONE) {
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

        address winner = _determineWinner(g.player1, g.player2, g.move1, g.move2);
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

    function _determineWinner(address p1, address p2, Move m1, Move m2) internal pure returns (address) {
        if (m1 == m2) return address(0);
        if (
            (m1 == Move.ROCK     && m2 == Move.SCISSORS) ||
            (m1 == Move.PAPER    && m2 == Move.ROCK)     ||
            (m1 == Move.SCISSORS && m2 == Move.PAPER)
        ) return p1;
        return p2;
    }

    function getGame(uint256 _gameId) external view returns (Game memory) {
        return games[_gameId];
    }
}