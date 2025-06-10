import React, { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";

const VoiceAgent = ({
  messages,
  setMessages,
  shouldStartCall,
  setShouldStartCall,
  setGenerating,
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

  const updateMessageList = (content, role) => {
    const msg = {
      id: Date.now().toString(),
      text: content,
      sender: role,
      time: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, msg]);
  };

  console.log(messages);

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
          updateMessageList(transcript, "user");
        }

        if (type === "response.audio_transcript.delta") {
          aiTranscriptRef.current += delta;
        }

        if (type === "response.audio_transcript.done") {
          updateMessageList(aiTranscriptRef.current.trim(), "bot");
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

  return (
    <>
      <button
        onClick={() => (callActive ? endCall() : setShouldStartCall(true))}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
          callActive ? "bg-red-500" : "bg-blue-600"
        }`}
      >
        {callActive && isAiSpeaking ? (
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
    </>
  );
};

export default VoiceAgent;
