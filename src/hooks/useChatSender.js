import { useState } from "react";
import * as pdfjs from "pdfjs-dist";

const useChatSender = (
  messages,
  setMessages,
  setInput,
  setAttachedFile,
  setFilePreview,
  systemPrompt
) => {
  const [loading, setLoading] = useState(false);

  // Process file content for both chat and voice
  const processFileContent = async (file) => {
    try {
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjs.getDocument({ data: arrayBuffer })
          .promise;
        let fullText = "";

        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n";
        }

        return fullText.trim();
      } else if (file.type.startsWith("text/")) {
        return await file.text();
      } else if (file.type.startsWith("image/")) {
        return `[Image file: ${file.name} - Image content available for analysis]`;
      }

      return `[File: ${file.name} - Content type: ${file.type}]`;
    } catch (error) {
      console.error("Error processing file:", error);
      return `[Error processing file: ${file.name}]`;
    }
  };

  const handleSend = async (input, attachedFile) => {
    if ((!input.trim() && !attachedFile) || loading) return;

    setLoading(true);

    try {
      // Process file content if file is attached
      let fileContent = null;
      if (attachedFile) {
        fileContent = await processFileContent(attachedFile);
      }

      // Create user message with file info
      const userMessage = {
        id: Date.now().toString(),
        text:
          input.trim() ||
          (attachedFile ? `Sent file: ${attachedFile.name}` : ""),
        sender: "user",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        ...(attachedFile && {
          file: attachedFile.name,
          fileType: attachedFile.type,
          filePreview: attachedFile.type.startsWith("image/")
            ? URL.createObjectURL(attachedFile)
            : null,
          fileContent: fileContent, // Include file content for voice agent
        }),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Prepare API request
      const conversationHistory = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages.map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        })),
      ];

      // Add current message to history
      let currentMessageContent = input.trim();

      if (attachedFile && fileContent) {
        currentMessageContent += `\n\n[File: ${attachedFile.name}]\n${fileContent}`;
      }

      conversationHistory.push({
        role: "user",
        content: currentMessageContent,
      });

      // Make API call
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: conversationHistory,
            max_tokens: 1000,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: assistantMessage,
          sender: "assistant",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Sorry, I encountered an error while processing your request. Please try again.",
          sender: "assistant",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
      setInput("");
      setAttachedFile(null);
      setFilePreview(null);
    }
  };

  return { handleSend, loading };
};

export default useChatSender;


