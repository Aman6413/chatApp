import { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime, formatLastSeen, getMessageStatusIcon, formatFileSize, getFileIcon, groupReactionsByEmoji, hasUserReacted, REACTION_EMOJIS } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";

function ChatContainer() {
  const { messages, selectedUser, setSelectedUser, sendMessage, getMessages, replyingTo, setReplyingTo } = useContext(ChatContext);
  const { authUser, onlineUsers, socket } = useContext(AuthContext);

  const scrollEnd = useRef();
  const messageRefs = useRef({});

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return;

    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      await sendMessage({ image: reader.result });
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleSendFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size should be less than 100MB");
      return;
    }

    toast.loading("Uploading file...");

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await sendMessage({ 
          file: {
            data: reader.result,
            name: file.name,
            type: file.type,
            size: file.size,
          }
        });
        toast.dismiss();
        e.target.value = "";
      } catch (error) {
        toast.dismiss();
        toast.error("Failed to upload file");
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id);
    }
  }, [getMessages, selectedUser]);

  useEffect(() => {
    if (scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    socket.on('typing', () => {
      setTyping(true);
    });

    socket.on('stopTyping', () => {
      setTyping(false);
    });

    return () => {
      socket.off('typing');
      socket.off('stopTyping');
    };
  }, [socket]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing', { receiverId: selectedUser._id });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId: selectedUser._id });
    }, 1000);
  };

  const handleAddReaction = (emoji, messageId) => {
    if (socket) {
      socket.emit("addReaction", {
        messageId,
        emoji,
        userId: authUser._id,
        receiverId: selectedUser._id,
      });
    }
    setShowReactionPicker(null);
  };

  const handleAddEmojiToInput = (emoji) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleReplyToMessage = (message) => {
    setReplyingTo({
      messageId: message._id,
      text: message.text || "[Image]",
      senderName: message.senderId === authUser._id ? "You" : selectedUser.fullName,
    });
  };

  const scrollToMessage = (messageId) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-violet-500/20");
      setTimeout(() => {
        element.classList.remove("bg-violet-500/20");
      }, 2000);
    }
  };

  return selectedUser ? (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      {/* Chat Header */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img src={ selectedUser.profilePic || assets.avatar_icon } alt="" className="w-8 rounded-full" />
        <div className="flex-1">
          <p className="text-lg text-white flex items-center gap-2">
            {selectedUser.fullName}
            {onlineUsers.includes(selectedUser._id) && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
          </p>
          <p className="text-xs text-gray-400">
            {onlineUsers.includes(selectedUser._id) ? "Online" : `Last seen ${formatLastSeen(selectedUser?.lastSeen)}`}
          </p>
        </div>
        <img
          onClick={() => setSelectedUser(null)}
          src={assets.arrow_icon}
          alt=""
          className="md:hidden max-w-7"
        />
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>
      {/* Chat Messages */}
      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6">
        {messages.map((msg, index) => (
          <div
            key={index}
            ref={el => messageRefs.current[msg._id] = el}
            className={`flex items-end gap-2 justify-end transition-colors ${
              msg.senderId !== authUser._id && "flex-row-reverse"
            }`}
          >
            {/* Replied Message */}
            {msg.replyTo && (
              <div className={`w-full ${msg.senderId === authUser._id ? "flex justify-end" : "flex justify-start"} mb-1`}>
                <div className={`max-w-[250px] px-3 py-2 rounded-lg border-l-4 border-violet-500 bg-gray-700/50 text-white text-sm ${
                  msg.senderId === authUser._id ? "mr-2" : "ml-2"
                }`}>
                  <p className="font-semibold text-xs text-violet-400">{msg.replyTo.senderName}</p>
                  <p className="text-xs truncate cursor-pointer hover:underline" onClick={() => scrollToMessage(msg.replyTo.messageId)}>
                    {msg.replyTo.image && "[Image] "}
                    {msg.replyTo.file && `[${msg.replyTo.file.fileName}] `}
                    {msg.replyTo.text}
                  </p>
                </div>
              </div>
            )}

            {msg.image ? (
              <img
                src={msg.image}
                alt=""
                className="max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8 cursor-pointer hover:opacity-80"
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleReplyToMessage(msg);
                }}
              />
            ) : msg.file ? (
              <a
                href={msg.file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={msg.file.fileName}
                className={`p-3 max-w-[250px] rounded-lg mb-8 flex items-center gap-3 bg-violet-500/30 hover:bg-violet-500/50 transition text-white cursor-pointer ${
                  msg.senderId === authUser._id
                    ? "rounded-br-none"
                    : "rounded-bl-none"
                }`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleReplyToMessage(msg);
                }}
              >
                <span className="text-2xl">{getFileIcon(msg.file.fileType)}</span>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold truncate">{msg.file.fileName}</p>
                  <p className="text-xs text-gray-300">{formatFileSize(msg.file.fileSize)}</p>
                </div>
              </a>
            ) : (
              <p
                className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-all bg-violet-500/30 text-white cursor-pointer hover:bg-violet-500/40 ${
                  msg.senderId === authUser._id
                    ? "rounded-br-none"
                    : "rounded-bl-none"
                }`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleReplyToMessage(msg);
                }}
              >
                {msg.text}
              </p>
            )}
            <div 
              className="text-center text-xs relative group"
              onMouseEnter={() => setShowReactionPicker(msg._id)}
              onMouseLeave={() => setShowReactionPicker(null)}
            >
              <img
                src={
                  msg.senderId === authUser._id
                    ? authUser?.profilePic || assets.avatar_icon
                    : selectedUser?.profilePic || assets.avatar_icon
                }
                alt=""
                className="w-7 rounded-full cursor-pointer"
              />
              <p className="text-gray-500">
                {formatMessageTime(msg.createdAt)}
              </p>
              {msg.senderId === authUser._id && (
                <p className={`text-xs font-semibold ${getMessageStatusIcon(msg).color}`}>
                  {getMessageStatusIcon(msg).icon}
                </p>
              )}

              {/* Reaction Picker */}
              {showReactionPicker === msg._id && (
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-full px-3 py-2 flex gap-2 z-50 shadow-lg border border-gray-600 whitespace-nowrap">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAddReaction(emoji, msg._id)}
                      className="text-lg hover:scale-125 transition cursor-pointer"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reactions Display */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 ml-2">
                {Object.entries(groupReactionsByEmoji(msg.reactions)).map(([emoji, userIds]) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddReaction(emoji, msg._id)}
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition ${
                      hasUserReacted(msg.reactions, emoji, authUser._id)
                        ? "bg-violet-500/60 border border-violet-400"
                        : "bg-gray-700 hover:bg-gray-600 border border-gray-600"
                    }`}
                    title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                  >
                    <span>{emoji}</span>
                    <span className="text-xs">{userIds.length}</span>
                  </button>
                ))}

                {/* Add Reaction Button */}
                <button
                  onMouseEnter={() => setShowReactionPicker(msg._id)}
                  onMouseLeave={() => setShowReactionPicker(null)}
                  className="text-xs px-1 py-0.5 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-400"
                  title="Add reaction"
                >
                  ➕
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollEnd}></div>
      </div>
      {/* Typing Indicator */}
      <div className="absolute bottom-[130px] left-0 right-0 flex items-center justify-center">
        {typing && <p className="text-gray-400 text-sm">{selectedUser.fullName} is typing...</p>}
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="absolute bottom-24 left-0 right-0 bg-gray-700/60 border-t border-gray-600 px-3 py-2 flex items-center gap-2">
          <div className="flex-1">
            <p className="text-xs text-violet-400 font-semibold">Replying to {replyingTo.senderName}</p>
            <p className="text-sm text-gray-300 truncate">{replyingTo.text}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* -------- bottom area -------- */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3">
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full relative">
          <input
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' ? handleSendMessage(e) : null}
            type="text"
            placeholder="Send a message"
            className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
          />
          
          {/* Emoji Picker Button */}
          <div ref={emojiPickerRef} className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-lg mr-2 cursor-pointer hover:scale-110 transition"
              title="Add emoji"
            >
              😊
            </button>

            {/* Emoji Picker Dropdown */}
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 bg-gray-800 rounded-lg p-3 z-50 shadow-lg border border-gray-600 grid grid-cols-4 gap-2 w-56">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddEmojiToInput(emoji)}
                    className="text-2xl hover:scale-125 transition cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
                {/* Additional emojis */}
                {["😊", "😎", "🤔", "😍", "🤗", "😢", "😡", "🤮", "🤢", "😴", "🤑", "🚀", "💯", "⚡", "🔥", "💀"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddEmojiToInput(emoji)}
                    className="text-2xl hover:scale-125 transition cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input onChange={handleSendImage} type="file" id="image" accept="image/png, image/jpeg" hidden />
          <label htmlFor="image">
            <img
              src={assets.gallery_icon}
              alt=""
              className="w-5 mr-2 cursor-pointer"
            />
          </label>
          <input onChange={handleSendFile} type="file" id="file" hidden />
          <label htmlFor="file">
            <span className="text-lg mr-2 cursor-pointer">📎</span>
          </label>
        </div>

        <img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-7 cursor-pointer" />
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
      <img src={assets.logo_icon} className="max-w-16" alt="" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
    </div>
  );
}

export default ChatContainer;
