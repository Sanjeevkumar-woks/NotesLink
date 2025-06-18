import React, { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, Info } from "lucide-react";
import Header from "./Header";
import useChatSender from "../hooks/useChatSender";
import { FaFile } from "react-icons/fa6";
import VoiceAgent from "./VoiceAgent";
import * as pdfjs from "pdfjs-dist";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ChatUI = () => {
  const [messages, setMessages] = useState([
    {
      sender: "dot",
      text: "Hello! I'm your AI assistant. How can I help you today?",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);

  const PROMPT = `You are an intelligent, friendly, and highly knowledgeable AI assistant designed to help users learn and explore a wide variety of topics. Your primary focus areas include:
Teaching English – Assist with grammar, vocabulary, pronunciation, sentence construction, and conversational English.

Web Development – Explain HTML, CSS, JavaScript, React, APIs, and modern web development practices.

PDF Reading and Interpretation – Read, analyze, and summarize PDF documents, including extracting important details or answering questions based on their content.

Social Topics – Provide thoughtful insights and explanations on topics like culture, behavior, relationships, and communication.

National and International News – Share updates or summaries about major national and global events (use fictional or generalized summaries if real-time data is not accessible).

General Knowledge & Life Skills – Answer questions about science, history, geography, education, technology, motivation, and more.

Always respond clearly, conversationally, and helpfully — as if you're a friendly human teacher or coach. Use simple language when needed, and adapt your responses based on the user's level of understanding. If the user uploads a file like a PDF, analyze it carefully and explain or summarize it in an easy-to-understand manner.

Your goal is to educate, empower, and engage the user across all these topics.`;

  const { handleSend: sendChatMessage, loading } = useChatSender(
    messages,
    setMessages,
    setInput,
    setAttachedFile,
    setFilePreview,
    PROMPT
  );

  // Helper function to process file content for limited voice context
  const processFileForVoice = async (file) => {
    try {
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjs.getDocument({ data: arrayBuffer })
          .promise;
        let fullText = "";

        // Only process first few pages for voice context
        const maxPages = Math.min(3, pdfDocument.numPages);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n";
        }

        return fullText.trim();
      } else if (file.type.startsWith("text/")) {
        const text = await file.text();
        // Limit text content for voice context
        return text.length > 3000 ? text.substring(0, 3000) + "..." : text;
      } else if (file.type.startsWith("image/")) {
        return `[Image file: ${file.name} - Image analysis not available in voice mode]`;
      }

      return `[File: ${file.name} - File type not supported in voice mode]`;
    } catch (error) {
      console.error("Error processing file for voice:", error);
      return `[Error processing file: ${file.name}]`;
    }
  };

  // Check if file is suitable for voice interaction

  const getFileVoiceStatus = () => {
    if (!attachedFile) return null;

    if (attachedFile.type.startsWith("image/")) {
      return {
        type: "unsupported",
        message:
          "Images cannot be analyzed via voice. Use text chat for image questions.",
      };
    }

    if (fileContent && fileContent.length > 4000) {
      return {
        type: "limited",
        message:
          "Large file detected. Voice chat will have limited context. Use text chat for detailed questions.",
      };
    }

    if (
      attachedFile.type === "application/pdf" ||
      attachedFile.type.startsWith("text/")
    ) {
      return {
        type: "supported",
        message: "File content available in voice chat with limited context.",
      };
    }

    return {
      type: "unsupported",
      message:
        "File type not supported in voice chat. Use text chat for file-related questions.",
    };
  };

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file);
      setShowFileInfo(true);

      // Process file content for voice agent
      const content = await processFileForVoice(file);
      setFileContent(content);

      if (file.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }

      // Hide file info after 5 seconds
      setTimeout(() => setShowFileInfo(false), 5000);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    setFileContent(null);
    setShowFileInfo(false);
  };

  // Helper to determine the icon based on file type
  const getFileDisplay = (fileType) => {
    if (fileType && fileType.startsWith("image/")) {
      return null;
    }

    let iconColor = "text-pink-500";
    if (fileType === "application/pdf") {
      iconColor = "text-red-500";
    }

    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <FaFile className={`w-5 h-5 ${iconColor}`} />
      </div>
    );
  };

  const fileStatus = getFileVoiceStatus();

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 to-purple-950 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl h-[450px] bg-[#0f0f1b] rounded-2xl shadow-lg flex flex-col relative">
          {/* File status notification */}
          {showFileInfo && fileStatus && (
            <div
              className={`absolute top-16 left-4 right-4 p-3 rounded-lg text-sm z-10 ${
                fileStatus.type === "supported"
                  ? "bg-green-500/20 border border-green-500/50 text-green-200"
                  : fileStatus.type === "limited"
                  ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-200"
                  : "bg-red-500/20 border border-red-500/50 text-red-200"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Info size={16} />
                <span>{fileStatus.message}</span>
                <button
                  onClick={() => setShowFileInfo(false)}
                  className="ml-auto text-current hover:opacity-70"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="p-4 border-b border-purple-800">
            <h2 className="text-pink-400 font-semibold text-lg">
              AI Voice Assistant
            </h2>
            {attachedFile && (
              <div className="text-sm text-gray-400 mt-1">
                📎 {attachedFile.name}
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    fileStatus?.type === "supported"
                      ? "bg-green-500/20 text-green-300"
                      : fileStatus?.type === "limited"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {fileStatus?.type === "supported"
                    ? "Voice Compatible"
                    : fileStatus?.type === "limited"
                    ? "Limited Voice Support"
                    : "Text Chat Only"}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-white custom-scrollbar">
            {messages.map((msg, index) =>
              msg.sender === "user" ? (
                <div key={index} className="flex justify-end">
                  <div className="bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-xl px-4 py-2 shadow-md">
                    <p>{msg.text}</p>
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
            {/* Attached File Preview */}
            {attachedFile && (
              <div className="flex items-center bg-gray-700 text-white px-3 py-2 rounded-lg text-sm max-w-sm">
                {filePreview && attachedFile.type.startsWith("image/") ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-8 h-8 object-cover rounded-md mr-2"
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
                  <span className="text-xs text-gray-300">
                    {attachedFile.type === "application/pdf" && "PDF"}
                    {attachedFile.type.startsWith("image/") && "Image"}
                    {attachedFile.type.startsWith("text/") && "Text Document"}
                    {!(
                      attachedFile.type.startsWith("image/") ||
                      attachedFile.type.startsWith("text/") ||
                      attachedFile.type === "application/pdf"
                    ) && "File"}
                  </span>
                </div>
                <button
                  onClick={removeAttachedFile}
                  className="ml-auto text-gray-400 hover:text-gray-200 p-1 rounded-full"
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

              <VoiceAgent
                messages={messages}
                setMessages={setMessages}
                shouldStartCall={isPlaying}
                setShouldStartCall={setIsPlaying}
                generating={generating}
                setGenerating={setGenerating}
                prompt={PROMPT}
                attachedFile={attachedFile}
                fileContent={fileContent}
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
