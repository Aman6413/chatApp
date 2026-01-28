export function formatMessageTime(date) {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
}

export function getMessageStatusIcon(message) {
  if (message.seen) {
    return { icon: "✓✓", color: "text-blue-400" };
  } else if (message.deliveredAt) {
    return { icon: "✓✓", color: "text-gray-400" };
  }
  return { icon: "✓", color: "text-gray-400" };
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function getFileIcon(fileType) {
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("sheet") || fileType.includes("excel")) return "📊";
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return "🎯";
  if (fileType.includes("zip") || fileType.includes("compressed") || fileType.includes("rar")) return "🗜️";
  if (fileType.includes("video")) return "🎬";
  if (fileType.includes("audio")) return "🎵";
  if (fileType.includes("text")) return "📃";
  return "📎";
}

export function groupReactionsByEmoji(reactions) {
  const grouped = {};
  reactions.forEach(({ emoji, userId }) => {
    if (!grouped[emoji]) {
      grouped[emoji] = [];
    }
    grouped[emoji].push(userId);
  });
  return grouped;
}

export function hasUserReacted(reactions, emoji, userId) {
  return reactions.some((r) => r.emoji === emoji && r.userId === userId);
}

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🙏"];

export function formatLastSeen(lastSeenDate) {
  if (!lastSeenDate) return "Never";
  
  const now = new Date();
  const lastSeen = new Date(lastSeenDate);
  
  if (isNaN(lastSeen.getTime())) return "Never";
  
  const diffMs = now - lastSeen;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return lastSeen.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
  