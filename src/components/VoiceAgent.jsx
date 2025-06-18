import React, { useState, useEffect, useRef } from "react";
import { Loader, Mic, AlertCircle } from "lucide-react";

const VoiceAgent = ({
  // eslint-disable-next-line no-unused-vars
  messages,
  setMessages,
  shouldStartCall,
  setShouldStartCall,
  generating,
  setGenerating,
  prompt,
  attachedFile,
  fileContent,
}) => {
  const dataChannelRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const aiSourceRef = useRef(null);
  const aiTranscriptRef = useRef("");
  const lastFileRef = useRef(null);
  const documentHistoryRef = useRef([]); // Store all document contexts
  const lastProcessedMessagesRef = useRef(0); // Track processed messages

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [showFileWarning, setShowFileWarning] = useState(false);

  const updateMessageList = (content, role) => {
    const msg = {
      id: Date.now().toString(),
      text: content,
      sender: role === "user" ? "user" : "assistant",
      time: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, msg]);
  };

  // Check if we have file content that's too large or complex for voice
  const isFileContentTooLarge = (content) => {
    if (!content) return false;
    return content.length > 3000; // Reduced limit to allow multiple documents
  };

  // Truncate content for voice context
  const truncateContent = (content, maxLength = 2000) => {
    if (!content) return "";
    if (content.length <= maxLength) return content;
    return (
      content.substring(0, maxLength) +
      "... [Content truncated for voice context]"
    );
  };

  // Extract files from messages that were sent via send button
  const extractFilesFromMessages = () => {
    const filesFromMessages = [];

    messages.forEach((msg, index) => {
      if (
        msg.sender === "user" &&
        msg.file &&
        index >= lastProcessedMessagesRef.current
      ) {
        const fileInfo = {
          name: msg.file,
          type: msg.fileType || "application/octet-stream",
          content: msg.fileContent
            ? truncateContent(msg.fileContent)
            : `[File: ${msg.file} - Content not available in voice mode]`,
          uploadTime: msg.time || new Date().toISOString(),
          id: `${msg.file}_${msg.time}_${index}`,
          source: "message",
        };
        filesFromMessages.push(fileInfo);
      }
    });

    return filesFromMessages;
  };

  // Add or update document in history
  const updateDocumentHistory = (file, content, source = "attachment") => {
    if (!file) return;

    const newDocument = {
      name: typeof file === "string" ? file : file.name,
      type: typeof file === "string" ? "application/octet-stream" : file.type,
      content: content
        ? truncateContent(content)
        : `[File content not available in voice mode]`,
      uploadTime: new Date().toISOString(),
      id:
        typeof file === "string"
          ? `${file}_${Date.now()}`
          : `${file.name}_${file.size}_${file.lastModified}`,
      source: source,
    };

    // Remove any existing document with the same name to avoid duplicates
    documentHistoryRef.current = documentHistoryRef.current.filter(
      (doc) => doc.name !== newDocument.name
    );
    documentHistoryRef.current.push(newDocument);

    // Keep only the last 5 documents to avoid context overflow
    if (documentHistoryRef.current.length > 5) {
      documentHistoryRef.current = documentHistoryRef.current.slice(-5);
    }

    console.log(
      "Document history updated:",
      documentHistoryRef.current.map((d) => `${d.name} (${d.source})`)
    );
  };

  // Sync documents from messages when call starts or new messages arrive
  const syncDocumentsFromMessages = () => {
    const filesFromMessages = extractFilesFromMessages();

    filesFromMessages.forEach((fileInfo) => {
      updateDocumentHistory(fileInfo.name, fileInfo.content, "message");
    });

    // Update the processed messages counter
    lastProcessedMessagesRef.current = messages.length;
  };

  // Create comprehensive context from all documents
  const createComprehensiveFileContext = () => {
    // First, sync any new files from messages
    syncDocumentsFromMessages();

    // Then add current attached file if it exists and is different
    const currentFile = attachedFile;
    const currentContent = fileContent;

    if (currentFile && currentContent) {
      updateDocumentHistory(currentFile, currentContent, "attachment");
    }

    if (documentHistoryRef.current.length === 0) return "";

    let context = "\n\nDOCUMENT CONTEXT:\n";
    context += `The user has access to ${documentHistoryRef.current.length} document(s):\n\n`;

    documentHistoryRef.current.forEach((doc, index) => {
      const isCurrentDoc = currentFile && doc.name === currentFile.name;
      const statusLabel = isCurrentDoc
        ? " (CURRENT ATTACHMENT)"
        : doc.source === "message"
        ? " (SENT VIA CHAT)"
        : " (PREVIOUS DOCUMENT)";

      context += `${index + 1}. "${doc.name}"${statusLabel}\n`;
      context += `   Type: ${doc.type}\n`;

      if (doc.type === "application/pdf") {
        context += `   PDF Content: "${doc.content}"\n\n`;
      } else if (doc.type.startsWith("text/")) {
        context += `   Text Content: "${doc.content}"\n\n`;
      } else if (doc.type.startsWith("image/")) {
        context += `   Image file - Cannot be analyzed via voice. Suggest text chat for image analysis.\n\n`;
      } else {
        context += `   File content: "${doc.content}"\n\n`;
      }
    });

    context += "IMPORTANT INSTRUCTIONS:\n";
    context +=
      "- You can reference any of the above documents when answering questions\n";
    context +=
      "- If user asks about 'the document' or 'this file', reference the most recent or relevant document\n";
    context +=
      "- If user asks about specific documents, reference them by name\n";
    context +=
      "- For detailed analysis of large documents or images, suggest using text chat\n";
    context +=
      "- Always specify which document you're referencing in your responses\n";
    context +=
      "- Documents sent via chat and current attachments are both available for reference\n";

    return context;
  };

  const buildContextualInstructions = () => {
    let instructions = `You are an intelligent, friendly AI assistant. Speak in a clear, friendly tone. ${
      prompt || ""
    }`;

    const fileContext = createComprehensiveFileContext();
    if (fileContext) {
      instructions += fileContext;
    }

    return instructions;
  };

  // Function to update session instructions during an active call
  const updateSessionInstructions = () => {
    if (callActive && dataChannelRef.current?.readyState === "open") {
      const contextualInstructions = buildContextualInstructions();

      try {
        dataChannelRef.current.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: contextualInstructions,
              input_audio_transcription: { model: "whisper-1" },
            },
          })
        );
        console.log(
          "Session instructions updated with comprehensive file context"
        );
        console.log(
          "Total documents in context:",
          documentHistoryRef.current.length
        );
        return true;
      } catch (error) {
        console.error("Failed to update session instructions:", error);
        return false;
      }
    }
    return false;
  };

  // Create a unique identifier for the current file state
  const getFileStateId = () => {
    if (!attachedFile) return null;
    return `${attachedFile.name}_${attachedFile.size}_${
      attachedFile.lastModified
    }_${fileContent ? fileContent.substring(0, 50) : "no-content"}`;
  };

  // Effect to monitor file changes during active call
  useEffect(() => {
    const currentFileStateId = getFileStateId();
    const lastFileStateId = lastFileRef.current;

    console.log("File state check:", {
      callActive,
      currentFileStateId,
      lastFileStateId,
      hasFile: !!attachedFile,
      hasContent: !!fileContent,
      dataChannelReady: dataChannelRef.current?.readyState === "open",
      documentsInHistory: documentHistoryRef.current.length,
      messagesLength: messages.length,
      lastProcessedMessages: lastProcessedMessagesRef.current,
    });

    // If file changed or new messages with files during active call, update session
    if (
      callActive &&
      (currentFileStateId !== lastFileStateId ||
        messages.length > lastProcessedMessagesRef.current)
    ) {
      console.log(
        "File state or messages changed during active call, updating session with all document history..."
      );

      // Small delay to ensure data channel is ready
      setTimeout(() => {
        const updateSuccess = updateSessionInstructions();

        if (updateSuccess) {
          const totalDocs = documentHistoryRef.current.length;

          // Show notification about file update
          if (attachedFile && currentFileStateId !== lastFileStateId) {
            const msg = {
              id: Date.now().toString(),
              text: `📎 New file attached: ${attachedFile.name}. I now have access to ${totalDocs} document(s) and can answer questions about any of them.`,
              sender: "assistant",
              time: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, msg]);
          } else if (messages.length > lastProcessedMessagesRef.current) {
            // New messages with potential files
            const newFilesCount = extractFilesFromMessages().length;
            if (newFilesCount > 0) {
              const msg = {
                id: Date.now().toString(),
                text: `📚 I've processed your recent messages and now have access to ${totalDocs} document(s). Feel free to ask questions about any of them!`,
                sender: "assistant",
                time: new Date().toLocaleTimeString(),
              };
              setMessages((prev) => [...prev, msg]);
            }
          } else if (lastFileStateId && !currentFileStateId) {
            // File was removed, but we still might have history
            const msg = {
              id: Date.now().toString(),
              text: `📎 Current file removed, but I still have access to ${totalDocs} document(s) from our conversation.`,
              sender: "assistant",
              time: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, msg]);
          }
        }
      }, 100);
    }

    lastFileRef.current = currentFileStateId;
  }, [attachedFile, fileContent, callActive, messages]);

  // Clear document history when call ends
  const clearDocumentHistory = () => {
    documentHistoryRef.current = [];
    lastProcessedMessagesRef.current = 0;
    console.log("Document history cleared");
  };

  const handleVoiceStart = () => {
    // Show warning if file is attached but not suitable for voice
    if (
      attachedFile &&
      (isFileContentTooLarge(fileContent) ||
        attachedFile.type.startsWith("image/"))
    ) {
      setShowFileWarning(true);
      setTimeout(() => setShowFileWarning(false), 5000);
    }
    setShouldStartCall(true);
  };

  const getToken = async () => {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "realtime=v1",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2024-12-17",
            voice: "alloy",
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create session");
      return await response.json();
    } catch (err) {
      console.error("getToken error:", err);
      throw err;
    }
  };

  const endCall = async () => {
    setGenerating(false);
    setIsAiSpeaking(false);
    setShouldStartCall(false);

    peerConnectionRef.current?.getSenders().forEach((s) => s.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.close();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.srcObject = null;
    }

    aiSourceRef.current?.disconnect();
    aiSourceRef.current = null;
    await remoteAudioCtxRef.current?.close();
    remoteAudioCtxRef.current = null;
    setCallActive(false);
    lastFileRef.current = null;

    // Clear document history when call ends
    clearDocumentHistory();
  };

  const startCall = async () => {
    try {
      setGenerating(true);
      const tokenRes = await getToken();
      const { client_secret } = tokenRes;

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const [audioTrack] = streamRef.current.getTracks();
      pc.addTrack(audioTrack);

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log(
          "Data channel opened, sending initial session update with document history"
        );
        const contextualInstructions = buildContextualInstructions();
        lastFileRef.current = getFileStateId();

        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: contextualInstructions,
              input_audio_transcription: { model: "whisper-1" },
            },
          })
        );

        // Send welcome message with document info
        setTimeout(() => {
          const totalDocs = documentHistoryRef.current.length;
          if (totalDocs > 0) {
            const msg = {
              id: Date.now().toString(),
              text: `🎙️ Voice chat started! I have access to ${totalDocs} document(s): ${documentHistoryRef.current
                .map((d) => d.name)
                .join(
                  ", "
                )}. You can ask me questions about any of these files.`,
              sender: "assistant",
              time: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, msg]);
          } else {
            const msg = {
              id: Date.now().toString(),
              text: `🎙️ Voice chat started! I'm ready to help you. If you have any files to discuss, you can attach them or send them via chat.`,
              sender: "assistant",
              time: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, msg]);
          }
        }, 500);
      };

      dc.onmessage = (e) => {
        const { type, transcript, delta } = JSON.parse(e.data);

        if (
          type === "conversation.item.input_audio_transcription.completed" &&
          transcript
        ) {
          updateMessageList(transcript, "user");
        }

        if (type === "response.audio_transcript.delta") {
          aiTranscriptRef.current += delta;
        }

        if (type === "response.audio_transcript.done") {
          updateMessageList(aiTranscriptRef.current.trim(), "assistant");
          aiTranscriptRef.current = "";
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current
            .play()
            .catch(() => remoteAudioCtxRef.current?.resume());
        }

        const audioCtx = new AudioContext();
        remoteAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(remoteStream);
        aiSourceRef.current = source;
        const analyser = audioCtx.createAnalyser();
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const interval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          setIsAiSpeaking(
            dataArray.reduce((a, b) => a + b) / dataArray.length > 10
          );
        }, 300);

        remoteStream.getTracks().forEach((t) => {
          t.addEventListener("ended", () => {
            clearInterval(interval);
            setIsAiSpeaking(false);
          });
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret.value}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      const answer = { type: "answer", sdp: await res.text() };
      await pc.setRemoteDescription(answer);
      setCallActive(true);
      setGenerating(false);
    } catch (err) {
      console.error("Start call error:", err);
      setGenerating(false);
      await endCall();
    }
  };

  useEffect(() => {
    if (shouldStartCall && !callActive) startCall();
    if (!shouldStartCall && callActive) endCall();
    return () => {
      endCall();
    };
  }, [shouldStartCall]);

  // Determine button appearance based on file status
  const getButtonColor = () => {
    if (callActive) return "bg-red-500";

    // Count total available documents (from messages + current attachment)
    const filesInMessages = extractFilesFromMessages().length;
    const totalDocs = filesInMessages + (attachedFile ? 1 : 0);

    if (totalDocs > 1) return "bg-purple-600"; // Multiple documents
    if (
      attachedFile &&
      !isFileContentTooLarge(fileContent) &&
      !attachedFile.type.startsWith("image/")
    ) {
      return "bg-green-600"; // File is compatible with voice
    }
    if (attachedFile || filesInMessages > 0) return "bg-yellow-600"; // Files available but limited compatibility
    return "bg-blue-600"; // No files
  };

  const getButtonTitle = () => {
    if (callActive) return "End voice chat";

    const filesInMessages = extractFilesFromMessages().length;
    const totalDocs = filesInMessages + (attachedFile ? 1 : 0);

    if (totalDocs > 1) return `Voice chat with ${totalDocs} documents`;
    if (attachedFile && isFileContentTooLarge(fileContent)) {
      return `Voice chat with limited file context (${attachedFile.name} is large)`;
    }
    if (attachedFile && attachedFile.type.startsWith("image/")) {
      return `Voice chat (${attachedFile.name} cannot be analyzed via voice)`;
    }
    if (attachedFile) return `Voice chat with ${attachedFile.name}`;
    if (filesInMessages > 0)
      return `Voice chat with ${filesInMessages} document(s) from chat`;
    return "Start voice chat";
  };

  return (
    <div className="relative">
      {/* Warning notification */}
      {showFileWarning && (
        <div className="absolute bottom-12 right-0 bg-yellow-500 text-black px-3 py-2 rounded-lg text-sm max-w-xs z-10">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} />
            <span>
              {attachedFile?.type.startsWith("image/")
                ? "Images can't be analyzed via voice. Use text chat for image questions."
                : "Large file detected. Use text chat for detailed questions."}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => (callActive ? endCall() : handleVoiceStart())}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${getButtonColor()}`}
        title={getButtonTitle()}
      >
        {generating ? (
          <Loader className="h-4 w-4 text-white animate-spin" />
        ) : callActive && isAiSpeaking ? (
          <div className="flex items-end space-x-1 h-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-[2px] h-full bg-white rounded-sm animate-voice-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        ) : (
          <Mic className="h-4 w-4 text-white" />
        )}
      </button>

      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </div>
  );
};

export default VoiceAgent;
