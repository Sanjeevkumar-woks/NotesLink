// Updated VoiceAgent.jsx (Component Logic + Visual Feedback)
import React, { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";

const VoiceAgent = ({
  setMessages,
  shouldStartCall,
  setShouldStartCall,
  //   setGenerating,
  prompt,
}) => {
  const dataChannelRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const aiSourceRef = useRef(null);
  const aiTranscriptRef = useRef("");

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callActive, setCallActive] = useState(false);

  const updateMessageList = (newMsg) => {
    setMessages((prevMessages) => [...prevMessages, newMsg]);
  };

  //  const getToken = async () => {

  // console.log("API Key", import.meta.env.VITE_OPENAI_API_KEY);

  //     try {
  //       const response = await fetch(
  //         "https://api.openai.com/v1/realtime/sessions",
  //         {
  //           method: "POST",
  //           headers: {
  //             Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`, // Ensure OPENAI_API_KEY is correctly set in your environment
  //             "Content-Type": "application/json",
  //             "OpenAI-Beta": "realtime=v1",
  //           },
  //           body: JSON.stringify({
  //             model: "gpt-4o-realtime-preview-2024-12-17",
  //             voice: "alloy",
  //           }),
  //         }
  //       );

  //       if (!response.ok) {
  //         const errorData = await response.json();
  //         console.error("OpenAI session creation failed:", errorData);
  //         throw new Error(
  //           `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`
  //         );
  //       }

  //       const data = await response.json();
  //       console.log("OpenAI session created:", data);
  //       return data
  //     } catch (err) {
  //       console.error("Session creation failed:", err);

  //     }
  //   };

  const getToken = async () => {
    //   console.log("API Key", import.meta.env.VITE_OPENAI_API_KEY); // Corrected prefix

    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`, // Ensure VITE_OPENAI_API_KEY is correctly set
            "Content-Type": "application/json",
            "OpenAI-Beta": "realtime=v1",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2024-12-17",
            voice: "alloy",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI session creation failed:", errorData);
        // IMPORTANT: Throw the error here
        throw new Error(
          `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      console.log("OpenAI session created:", data);

      
      return data; // Successfully return data
    } catch (err) {
      console.error("Session creation failed (in getToken):", err);
      // IMPORTANT: Re-throw the error so `startCall` can catch it.
      throw err;
    }
  };

  const endCall = async () => {
    // setGenerating(false);
    setIsAiSpeaking(false);
    setShouldStartCall(false); // Signal parent to stop the call if it's controlling

    peerConnectionRef.current?.getSenders().forEach((s) => s.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (dataChannelRef.current?.readyState === "open")
      dataChannelRef.current.close();
    dataChannelRef.current = null; // Clear ref after closing

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.srcObject = null;
    }

    aiSourceRef.current?.disconnect();
    aiSourceRef.current = null;

    try {
      await remoteAudioCtxRef.current?.close();
    } catch (e) {
      console.warn("Error closing remote audio context:", e);
    }
    remoteAudioCtxRef.current = null;

    setCallActive(false);
  };

  const startCall = async () => {
    console.log("Starting Call")
    try {
      //setGenerating(true); // Uncomment if you use this
      const data = await getToken(); // Directly destructure client_secret
      console.log(data)
      const { client_secret }=data
      console.log(client_secret, "client_secret");

      // The rest of your startCall logic remains the same
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
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: `Speak in a clear, friendly Indian tone. ${
                prompt || ""
              }`,
              input_audio_transcription: { model: "whisper-1" },
            },
          })
        );
      };

      dc.onmessage = (e) => {
        const { type, transcript, delta } = JSON.parse(e.data);
        if (
          type === "conversation.item.input_audio_transcription.completed" &&
          transcript
        ) {
          updateMessageList({
            id: Date.now().toString(),
            content: transcript,
            role: "user",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }), // Add time
          });
        }
        if (type === "response.audio_transcript.delta")
          aiTranscriptRef.current += delta;
        if (type === "response.audio_transcript.done") {
          updateMessageList({
            id: (Date.now() + 1).toString(),
            content: aiTranscriptRef.current.trim(),
            role: "bot",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }), // Add time
          });
          aiTranscriptRef.current = "";
        }
      };

      // Handle data channel close/error
      dc.onclose = () => {
        console.log("Data channel closed, ending call.");
        endCall();
      };
      dc.onerror = (error) => {
        console.error("Data channel error:", error);
        endCall();
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.volume = 1.0;
          audioRef.current
            .play()
            .catch((err) =>
              console.error(
                "Audio playback failed, trying to resume context:",
                err
              )
            );
        }

        const audioCtx = new AudioContext();
        remoteAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(remoteStream);
        aiSourceRef.current = source;
        const analyser = audioCtx.createAnalyser();
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinBinCount); // Typo corrected: frequencyBinCount
        const interval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const volume =
            dataArray.reduce((a, b) => a + b, 0) / dataArray.length; // Calculate average volume
          setIsAiSpeaking(volume > 10);
        }, 300);

        remoteStream.getTracks().forEach((t) =>
          t.addEventListener("ended", () => {
            console.log("Remote audio track ended.");
            clearInterval(interval);
            setIsAiSpeaking(false);
            remoteAudioCtxRef.current
              ?.close()
              .catch((e) =>
                console.warn(
                  "Error closing remote audio context on track ended:",
                  e
                )
              );
            remoteAudioCtxRef.current = null;
          })
        );
      };

      // Handle peer connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "closed"
        ) {
          console.log("ICE connection lost, ending call.");
          endCall();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret.value}`, // Use backticks for template literal
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`OpenAI Realtime API failed: ${res.statusText}`);
      }

      const answer = { type: "answer", sdp: await res.text() };
      await pc.setRemoteDescription(answer); // Type assertion removed
      setCallActive(true);
      //   setGenerating(false);
    } catch (err) {
      console.error("Start call error:", err);
      //   setGenerating(false);
      await endCall();
    }
  };

  useEffect(() => {
    if (shouldStartCall && !callActive) {
      startCall();
    } else if (!shouldStartCall && callActive) {
      endCall();
    }
    // Cleanup function for unmounting
    return () => {
      endCall();
    };
  }, [shouldStartCall, callActive]); // Added callActive to dependencies for proper effect execution

  return (
    <>
      <button
        onClick={() => (callActive ? endCall() : setShouldStartCall(true))}
        className={`w-16 h-16 flex items-center justify-center rounded-full transition-all duration-300 ${
          callActive ? "bg-red-500" : "bg-blue-600"
        }`}
      >
        {callActive && isAiSpeaking ? (
          <div className="flex items-end space-x-1 h-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] h-full bg-white rounded-sm animate-voice-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`, // Use template literal for styles
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </button>
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </>
  );
};

export default VoiceAgent;
