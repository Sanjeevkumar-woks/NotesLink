// chatData.js

// Helper function to get the current time in a readable format
const getCurrentTime = () => {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const chatData = [
  {
    sender: "assistant",
    text: "Hello! I'm your AI assistant. How can I help you today?",
    time: getCurrentTime(), // This will now be dynamic!
  },
];

export default chatData;