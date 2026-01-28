import Message from "../models/message.js";
import User from "../models/user.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

// Sidebar users
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    const users = await User.find({ _id: { $ne: userId } }).select("-password");

    const unseenMessages = {};

    await Promise.all(
      users.map(async (user) => {
        const count = await Message.countDocuments({
          senderId: user._id,
          receiverId: userId,
          seen: false,
        });
        if (count > 0) unseenMessages[user._id] = count;
      })
    );

    res.json({ success: true, users, unseenMessages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get messages
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: id },
        { senderId: id, receiverId: myId },
      ],
    });

    await Message.updateMany(
      { senderId: id, receiverId: myId, seen: false },
      { $set: { seen: true } }
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Mark message seen
export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, { seen: true, seenAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { text, image, file, replyTo } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    let imageUrl;
    let fileData = null;
    let replyData = null;

    if (image) {
      const upload = await cloudinary.uploader.upload(image);
      imageUrl = upload.secure_url;
    }

    if (file && file.data) {
      try {
        // For non-image files, use resource_type: "raw"
        const upload = await cloudinary.uploader.upload(file.data, {
          resource_type: "raw",
          folder: "chatapp/files",
        });
        fileData = {
          fileUrl: upload.secure_url,
          fileName: file.name || upload.public_id,
          fileType: file.type || "unknown",
          fileSize: file.size || 0,
        };
      } catch (uploadError) {
        console.log("File upload error:", uploadError.message);
        return res.json({ success: false, message: "File upload failed: " + uploadError.message });
      }
    }

    // Handle reply to message
    if (replyTo && replyTo.messageId) {
      const originalMessage = await Message.findById(replyTo.messageId);
      if (originalMessage) {
        replyData = {
          messageId: originalMessage._id,
          text: replyTo.text || originalMessage.text || "[Image]",
          senderName: replyTo.senderName || "User",
          image: originalMessage.image,
          file: originalMessage.file ? {
            fileName: originalMessage.file.fileName,
            fileType: originalMessage.file.fileType,
          } : null,
        };
      }
    }

    const receiverSocketId = userSocketMap[receiverId];
    const deliveredAt = receiverSocketId ? new Date() : null;

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      file: fileData,
      replyTo: replyData,
      deliveredAt: deliveredAt,
    });

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.json({ success: true, newMessage });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Typing event handler
export const handleTyping = (socket) => {
  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { userId: socket.userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { userId: socket.userId });
    }
  });

  // Handle message seen event
  socket.on("messageSeen", async ({ messageId, senderId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { seen: true, seenAt: new Date() });
      const senderSocketId = userSocketMap[senderId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageSeen", { messageId });
      }
    } catch (error) {
      console.log("Error marking message as seen:", error);
    }
  });

  // Handle emoji reactions
  socket.on("addReaction", async ({ messageId, emoji, userId, receiverId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      // Check if user already reacted with this emoji
      const existingReaction = message.reactions.find(
        (r) => r.emoji === emoji && r.userId.toString() === userId
      );

      if (existingReaction) {
        // Remove reaction if it already exists (toggle)
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId.toString() === userId)
        );
      } else {
        // Add new reaction
        message.reactions.push({ emoji, userId });
      }

      await message.save();

      // Broadcast reaction update to both sender and receiver
      const receiverSocketId = userSocketMap[receiverId];
      const senderSocketId = userSocketMap[message.senderId];

      const reactionUpdate = { messageId, reactions: message.reactions };

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("reactionUpdated", reactionUpdate);
      }
      if (senderSocketId) {
        io.to(senderSocketId).emit("reactionUpdated", reactionUpdate);
      }
    } catch (error) {
      console.log("Error adding reaction:", error);
    }
  });
};
