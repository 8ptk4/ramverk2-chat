const express = require("express");
const app = express();
const router = express.Router();
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongo = require("mongodb").MongoClient;
const server = require("http").createServer(app);
const io = require("socket.io")(server);

const dns = "mongodb://localhost/chat";
app.use(cors());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users.js");

let history = [];

mongo.connect(dns, function(err, client) {
  if (err) {
    throw err;
  }

  const chatDB = client.db("chat");
  const Col = chatDB.collection("messages");

  io.on("connection", socket => {
    socket.on("connect", () => {
      history.map((message, i) =>
        socket.emit("message", {
          user: message.user,
          text: message.text,
          time: message.time
        })
      );
    });

    socket.on("join", ({ name, room }, callback) => {
      const { error, user } = addUser({ id: socket.id, name, room });

      if (error) return callback(error);

      const joinMessage = {
        user: "*",
        text: `${user.name}, has joined the chat!`,
        time: null
      };

      Col.insertMany([joinMessage]);

      Col.find()
        .toArray()
        .then(res => {
          res.map((message, i) =>
            socket.emit("message", {
              user: message.user,
              text: message.text,
              time: message.time
            })
          );
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

      const newMessage = {
        user: user.name,
        text: message,
        time: currentTime
      };

      io.to(user.room).emit("message", newMessage);

      Col.insertMany([newMessage]);

      callback();
    });

    socket.on("disconnect", () => {
      const user = removeUser(socket.id);

      const disconnectMessage = {
        user: "*",
        text: `${user.name}, has left the chat!`,
        time: null
      };

      Col.insertMany([disconnectMessage]);

      if (user) {
        io.to(user.room).emit("message", {
          user: "*",
          text: `${user.name} has left.`
        });
      }
    });
  });
});

server.listen(5000);
