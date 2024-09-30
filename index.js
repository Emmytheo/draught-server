const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let games = {}; // To store all active games

wss.on("connection", (ws) => {
  console.log("New client connected!");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "createGame":
        // Create a new game room
        const gameId = uuidv4();
        games[gameId] = { players: [ws], gameStarted: false };
        ws.send(JSON.stringify({ type: "gameCreated", gameId }));
        console.log(`Game created with ID: ${gameId}`);
        break;

      case "joinGame":
        // Join an existing game room
        const room = games[data.gameId];
        if (room) {
          if (room.players.length < 2) {
            room.players.push(ws);
            room.players.forEach((player, index) => {
              player.send(
                JSON.stringify({
                  type: "gameJoined",
                  playerNumber: index + 1,
                })
              );
            });
            room.gameStarted = true;
            room.players[0].send(
              JSON.stringify({ type: "start", yourTurn: true })
            );
            room.players[1].send(
              JSON.stringify({ type: "start", yourTurn: false })
            );
          } else {
            ws.send(JSON.stringify({ type: "error", message: "Game full!" }));
          }
        } else {
          ws.send(
            JSON.stringify({ type: "error", message: "Game not found!" })
          );
        }
        break;

      case "move":
        // Forward the move to the opponent
        const gameRoom = Object.values(games).find((room) =>
          room.players.includes(ws)
        );
        if (gameRoom) {
          const opponent = gameRoom.players.find((player) => player !== ws);
          if (opponent) {
            opponent.send(
              JSON.stringify({
                type: "opponentMove",
                move: data.move,
              })
            );
          }
        }
        break;

      case "exitGame":
        // Exit from the game
        const exitGameRoom = Object.values(games).find((room) =>
          room.players.includes(ws)
        );
        if (exitGameRoom) {
          exitGameRoom.players = exitGameRoom.players.filter(
            (player) => player !== ws
          );
          ws.send(JSON.stringify({ type: "gameExited" }));
          console.log(`Player exited game`);
          if (exitGameRoom.players.length === 0) {
            // Delete the game if both players leave
            const gameIdToDelete = Object.keys(games).find(
              (id) => games[id] === exitGameRoom
            );
            delete games[gameIdToDelete];
            console.log(`Game ${gameIdToDelete} deleted`);
          } else {
            exitGameRoom.players[0].send(
              JSON.stringify({ type: "opponentLeft" })
            );
          }
        }
        break;
    }
  });

  ws.on("close", () => {
    // Handle player disconnection
    const disconnectedGame = Object.values(games).find((room) =>
      room.players.includes(ws)
    );
    if (disconnectedGame) {
      disconnectedGame.players = disconnectedGame.players.filter(
        (player) => player !== ws
      );
      if (disconnectedGame.players.length === 0) {
        const gameId = Object.keys(games).find(
          (id) => games[id] === disconnectedGame
        );
        delete games[gameId];
        console.log(`Game ${gameId} deleted after player disconnection`);
      }
    }
    console.log("Client disconnected!");
  });
});

app.get("/", (req, res) => {
  res.send("Draughts WebSocket server running");
});

server.listen(8080, () => {
  console.log("Server is running on port 8080");
});
