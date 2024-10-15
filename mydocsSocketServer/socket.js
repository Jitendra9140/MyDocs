const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const dns = require('dns');
const tls = require('tls');
const net = require('net');

// Initialize express app and server
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

app.use(cors());

let onlineUser = [];

// Helper functions for user management
const addUser = (userId, socketId) => {
  !onlineUser.some((user) => user.userId === userId) &&
    onlineUser.push({ userId: userId, socketId: socketId });
};

const removeUser = (socketId) => {
  onlineUser = onlineUser.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return onlineUser.find((user) => user.userId === userId);
};

// Set up socket.io with CORS handling
const io = new Server(server, {
  cors: {
    origin: process.env.FRONT_LINK,
    methods: ["GET", "POST"],
  },
});

// Socket.io connection handling
io.on("connection", (socket) => {
  // Room join event
  socket.on("join__room", (data) => {
    socket.join(data);
    const clientsInRoom = io.sockets.adapter.rooms.get(data);
    if (clientsInRoom && clientsInRoom.size > 1) {
      const socketsInRoom = Array.from(clientsInRoom);
      const id = socketsInRoom[0];
      io.to(id).emit("_____", socket.id);
      io.to(socket.id).emit("isUserAllredy", true);
    } else {
      io.to(socket.id).emit("isUserAllredy", false);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    removeUser(socket.id);
  });

  // New user event
  socket.on("newUser", (userId) => {
    addUser(userId, socket.id);
  });

  // Messaging events
  socket.on("send__massage", (data) => {
    socket.to(data.room).emit("receive__massage", data.massage);
  });

  socket.on("send__massage_To", (data) => {
    io.to(data.to).emit("receive__massage", data.massage);
  });

  // Notification update event
  socket.on("update__notification", (data) => {
    try {
      const receiver = getUser(data);
      io.to(receiver.socketId).emit("new__notification");
    } catch (error) {
      console.log(error);
    }
  });
});

// Custom DNS lookup function
function customLookup(hostname, callback) {
  console.log(`Custom lookup for: ${hostname}`);
  if (hostname === 'www.google.com') {
    // Providing a custom IP for 'www.google.com'
    callback(null, '142.250.71.100', 4);
  } else {
    // Default DNS lookup for other hosts
    dns.lookup(hostname, callback);
  }
}

// Function to create a secure connection using TLS
function makeSecureRequest(hostname, path) {
  return new Promise((resolve, reject) => {
    customLookup(hostname, (err, address) => {
      if (err) {
        return reject(`DNS lookup failed: ${err.message}`);
      }
      console.log(`Resolved IP: ${address}`);

      // Create a connection using `net`
      const socket = net.connect(443, address, () => {
        console.log(`Connected to ${hostname} (${address})`);

        // Upgrade the connection to TLS
        const secureSocket = tls.connect({
          host: hostname,  // SNI for TLS handshake
          servername: hostname,
          socket: socket,
          rejectUnauthorized: false, // Ignoring SSL validation for testing purposes
        }, () => {
          console.log('TLS connection established');

          // Sending HTTP GET request over TLS
          secureSocket.write(`GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`);
        });

        let data = '';
        // Receive response data
        secureSocket.on('data', (chunk) => {
          data += chunk;
        });

        secureSocket.on('end', () => {
          resolve(data);  // Resolve promise with response data
        });

        secureSocket.on('error', (e) => {
          reject(`TLS connection failed: ${e.message}`);
        });
      });

      socket.on('error', (e) => {
        reject(`Connection failed: ${e.message}`);
      });
    });
  });
}

// Testing the secure request
async function runRequest() {
  try {
    const response = await makeSecureRequest('www.google.com', '/');
    console.log(`Response received: ${response.substring(0, 200)}...`);  // Log part of the response
  } catch (error) {
    console.error(error);  // Handle errors in the request
  }
}

runRequest();  // Call function to execute request

// Start the server
server.listen(port, () => {
  console.log(`Socket server is listening on port ${port}`);
});
