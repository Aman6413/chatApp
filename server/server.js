import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
import { handleTyping } from './controllers/messageController.js';
import User from "./models/user.js";
import Message from "./models/message.js";

const app = express();
const server = http.createServer(app);

// Ensure the socket connection is established before using io
export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
// Store online users (userId -> socketId)
export const userSocketMap = {};

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log('User connected:', userId);

    if (userId) {
        socket.userId = userId;
        userSocketMap[userId] = socket.id;
        
        // Mark all pending messages as delivered
        Message.updateMany(
            { receiverId: userId, deliveredAt: null },
            { deliveredAt: new Date() }
        ).then(result => {
            if (result.modifiedCount > 0) {
                // Get all senders of those messages and notify them
                Message.find({ receiverId: userId, seenAt: null })
                    .select('senderId')
                    .distinct('senderId')
                    .then(senderIds => {
                        senderIds.forEach(senderId => {
                            const senderSocketId = userSocketMap[senderId];
                            if (senderSocketId) {
                                io.to(senderSocketId).emit("messagesDelivered", { receiverId: userId });
                            }
                        });
                    });
            }
        }).catch(err => console.log("Error marking messages as delivered:", err));
        
        handleTyping(socket);
    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    socket.on('disconnect', () => {
        console.log('User disconnected:', userId);
        delete userSocketMap[userId];
        
        // Update lastSeen in database
        if (userId) {
            User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(err => console.log("Error updating lastSeen:", err));
        }
        
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
});

// Middlewares
app.use(express.json({ limit: "4mb" }));
app.use(cors());

// Routes
app.use("/api/status", (req, res) => res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

// DB
await connectDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("Server running on PORT:", PORT);
});
