import express from "express";
import protectedRoute from "../middlewares/auth.js";
import { getUsersForSidebar, getMessages, markMessageAsSeen, sendMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectedRoute, getUsersForSidebar);
messageRouter.get("/:id", protectedRoute, getMessages);
messageRouter.put("mark/:id", protectedRoute, markMessageAsSeen);
messageRouter.post("/send/:id", protectedRoute, sendMessage);

export default messageRouter;
