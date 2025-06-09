import React, { useEffect, useRef, useState } from "react";
import { Mic, Send, Paperclip, X } from "lucide-react";
import Header from "./Header";
import chatData from "../data/chatData";
import useChatSender from "../hooks/useChatSender";

import { FaFile } from "react-icons/fa6"; // Import FaFile
import VoiceAgent from "./VoiceAgent";

const ChatUI = () => {
  const [messages, setMessages] = useState(chatData);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null); // Stores the File object
  const [filePreview, setFilePreview] = useState(null); // Stores URL for image preview
  const messagesEndRef = useRef(null);
  const [isPlaying,setIsPlaying] = useState(false);
  const PROMPT = "Your an AI assestent help to lear English";

  // const [shouldStartCall,setShouldStartCall]  = useState(false)
  const { handleSend: sendChatMessage, loading } = useChatSender(
    messages,
    setMessages,
    setInput,
    setAttachedFile,
    setFilePreview
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendButtonClick = () => {
    sendChatMessage(input, attachedFile);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      sendChatMessage(input, attachedFile);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file);
      if (file.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
  };

  // Helper to determine the icon based on file type using react-icons
  const getFileDisplay = (fileType) => {
    if (fileType && fileType.startsWith("image/")) {
      return null; // For images, we'll use the img tag directly for preview
    }

    let iconColor = "text-pink-500"; // Default pink for general documents
    if (fileType === "application/pdf") {
      iconColor = "text-red-500"; // Red specifically for PDFs
    }

    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <FaFile className={`w-5 h-5 ${iconColor}`} />
      </div>
    );
  };

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 to-purple-950 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl h-[450px] bg-[#0f0f1b] rounded-2xl shadow-lg flex flex-col">
          <div className="p-4 border-b border-purple-800">
            <h2 className="text-pink-400 font-semibold text-lg">
              AI Voice Assistant
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-white custom-scrollbar">
            {messages.map((msg, index) =>
              msg.sender === "user" ? (
                <div key={index} className="flex justify-end">
                  <div className="bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-xl px-4 py-2 shadow-md">
                    <p>{msg.text}</p>
                    {/* Render the attached file preview based on the new design */}
                    {msg.file && (
                      <div className="mt-2 p-2 bg-purple-700/50 rounded-md flex items-center space-x-2">
                        {msg.fileType &&
                        msg.filePreview &&
                        msg.fileType.startsWith("image/") ? (
                          <img
                            src={msg.filePreview}
                            alt="Attached Preview"
                            className="max-w-[50px] max-h-[50px] rounded"
                          />
                        ) : (
                          getFileDisplay(msg.fileType)
                        )}
                        <div className="flex flex-col">
                          <p className="text-sm font-medium">{msg.file}</p>
                          {msg.fileType === "application/pdf" && (
                            <span className="text-xs text-gray-300">PDF</span>
                          )}
                          {msg.fileType.startsWith("image/") && (
                            <span className="text-xs text-gray-300">Image</span>
                          )}
                          {msg.fileType.startsWith("text/") && (
                            <span className="text-xs text-gray-300">
                              Text Document
                            </span>
                          )}
                          {!(
                            msg.fileType.startsWith("image/") ||
                            msg.fileType.startsWith("text/") ||
                            msg.fileType === "application/pdf"
                          ) && (
                            <span className="text-xs text-gray-300">File</span>
                          )}
                        </div>
                      </div>
                    )}
                    <span className="text-xs text-gray-300 block text-right mt-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={index} className="flex justify-start">
                  <div className="max-w-[75%] bg-[#1e1e2e] rounded-lg p-3 shadow-md">
                    <p dangerouslySetInnerHTML={{ __html: msg.text }}></p>
                    <span className="text-xs text-gray-400 block mt-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex justify-start">
                {" "}
                {/* Wrap in flex to align left */}
                <div className="max-w-[75%] bg-[#1e1e2e] rounded-lg p-3 ai-waiting-dots">
                  <div className="ai-waiting-dot"></div>
                  <div className="ai-waiting-dot"></div>
                  <div className="ai-waiting-dot"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Section */}
          <div className="p-4 border-t border-purple-800 flex flex-col space-y-2">
            {/* Attached File Preview (at the bottom, before input) */}
            {attachedFile && (
              <div className="flex items-center bg-gray-700 text-white px-3 py-2 rounded-lg text-sm max-w-sm">
                {" "}
                {/* Adjusted styling to match image */}
                {filePreview && attachedFile.type.startsWith("image/") ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-8 h-8 object-cover rounded-md mr-2" // Smaller image preview for consistency
                  />
                ) : (
                  <div className="mr-2">
                    {getFileDisplay(attachedFile.type)}
                  </div>
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">
                    {attachedFile.name}
                  </span>
                  {attachedFile.type === "application/pdf" && (
                    <span className="text-xs text-gray-300">PDF</span>
                  )}
                  {attachedFile.type.startsWith("image/") && (
                    <span className="text-xs text-gray-300">Image</span>
                  )}
                  {attachedFile.type.startsWith("text/") && (
                    <span className="text-xs text-gray-300">Text Document</span>
                  )}
                  {!(
                    attachedFile.type.startsWith("image/") ||
                    attachedFile.type.startsWith("text/") ||
                    attachedFile.type === "application/pdf"
                  ) && <span className="text-xs text-gray-300">File</span>}
                </div>
                <button
                  onClick={removeAttachedFile}
                  className="ml-auto text-gray-400 hover:text-gray-200 p-1 rounded-full" // Adjusted remove button styling
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 rounded-full px-4 py-2 bg-gray-800 text-white placeholder-gray-400 outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading}
              />

              {/* Hidden File Input */}
              <input
                type="file"
                id="fileInput"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,image/*"
                disabled={loading}
              />
              <label htmlFor="fileInput">
                <Paperclip
                  className={`text-pink-400 ${
                    loading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:text-pink-600 cursor-pointer"
                  }`}
                />
              </label>

              <Mic
                className={`text-pink-400 ${
                  loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              />

              <VoiceAgent
                messages={messages}
                setMessages={setMessages}
                shouldStartCall={isPlaying}
                setShouldStartCall={setIsPlaying}
                // setGenerating={setIsLoading}
                prompt={PROMPT}
              />
              <Send
                onClick={handleSendButtonClick}
                className={`text-pink-400 ${
                  loading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:text-pink-600"
                }`}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatUI;
