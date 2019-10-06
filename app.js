const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");

app.use(cors());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users.js");

const server = require("http").createServer(app);
const io = require("socket.io")(server);

io.on("connection", socket => {
  socket.on("join", ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.emit("message", {
      user: "*",
      text: `${user.name}, welcome to the room ${user.room}`
    });

    socket.broadcast
      .to(user.room)
      .emit("message", { user: "*", text: `${user.name}, has joined!` });

    socket.join(user.room);

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);

    const today = new Date();
    const currentTime =
      today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

    io.to(user.room).emit("message", {
      user: user.name,
      text: message,
      time: currentTime
    });

    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", {
        user: "*",
        text: `${user.name} has left.`
      });
    }
  });
});

server.listen(5000);
