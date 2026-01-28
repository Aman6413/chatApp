/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext.jsx";
import toast from "react-hot-toast";

export const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [unseenMessages, setUnseenMessages] = useState({});
    const [replyingTo, setReplyingTo] = useState(null);

    const { socket, axios } = useContext(AuthContext);

    // Function to get all users for sidebar
    const getUsers = async () => {
        try {
            const { data } = await axios.get("/api/messages/users");
            if(data.success) {
                setUsers(data.users);
                setUnseenMessages(data.unseenMessages);
            }
        } catch (error) {
            toast.error(error.messages);
        }
    };

    // Function to get messages with a specific user
    const getMessages = async (userId) => {
        try {
            const { data } = await axios.get(`/api/messages/${userId}`);
            if(data.success) {
                setMessages(data.messages);
            }
        } catch (error) {
            toast.error(error.messages);
        }
    };

    // Function to send a message
    const sendMessage = async (messageData) => {
        try {
            const dataToSend = {
                ...messageData,
                ...(replyingTo && { replyTo: replyingTo })
            };
            const { data } = await axios.post(`/api/messages/send/${selectedUser._id}`, dataToSend);
            if(data.success) {
                setMessages(prev => [...prev, data.newMessage]);
                setReplyingTo(null);
            }else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.messages);
        }
    };

    // Function to subscribe to messages for selected user
    const subscribeToMessages = (userId) => {
        if(!socket) return;

        socket.on("newMessage", (newMessage) => {
            if(selectedUser && newMessage.senderId === selectedUser._id) {
                setMessages(prev => [...prev, newMessage]);
                // Mark as seen via socket for real-time update
                socket.emit("messageSeen", { 
                    messageId: newMessage._id, 
                    senderId: newMessage.senderId 
                });
                // Also call API for persistence
                axios.put(`/api/messages/mark/${newMessage._id}`);
            }else {
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: prev[newMessage.senderId] ? prev[newMessage.senderId] + 1 : 1
                }));
            }
        });

        // Listen for seen status updates
        socket.on("messageSeen", ({ messageId }) => {
            setMessages(prev => 
                prev.map(msg => msg._id === messageId ? { ...msg, seen: true } : msg)
            );
        });

        // Listen for delivery status updates
        socket.on("messagesDelivered", ({ receiverId }) => {
            setMessages(prev => 
                prev.map(msg => 
                    msg.receiverId === receiverId && !msg.deliveredAt ? { ...msg, deliveredAt: new Date() } : msg
                )
            );
        });

        // Listen for reaction updates
        socket.on("reactionUpdated", ({ messageId, reactions }) => {
            setMessages(prev => 
                prev.map(msg => msg._id === messageId ? { ...msg, reactions } : msg)
            );
        });
    };

    // Function to unsubscribe from messages
    const unsubscribeFromMessages = () => {
        if(!socket) return;
        socket.off("newMessage");
        socket.off("messageSeen");
        socket.off("messagesDelivered");
        socket.off("reactionUpdated");
    };

    useEffect(() => {
        subscribeToMessages();
        return () => {
            unsubscribeFromMessages();
        };
    }, [socket, selectedUser]);

    const value = {
        messages,
        users,
        selectedUser,
        getUsers,
        sendMessage,
        setSelectedUser,
        unseenMessages,
        setUnseenMessages,
        getMessages,
        replyingTo,
        setReplyingTo,
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
