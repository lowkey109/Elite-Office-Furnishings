import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, Send, X, Sparkles, Bot, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? "bg-amber-500/20 border border-amber-500/30" : "bg-violet-500/20 border border-violet-500/30"
      }`}>
        {isUser ? <span className="text-[10px] text-amber-300 font-bold">YOU</span> : <Sparkles className="w-3.5 h-3.5 text-violet-300" />}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {msg.imageUrl && (
          <img
            src={msg.imageUrl}
            alt="Attached"
            className="max-h-48 max-w-xs rounded-xl border border-white/10 object-cover"
          />
        )}
        {msg.content && (
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-amber-500/20 border border-amber-500/25 text-white rounded-br-sm"
              : "bg-zinc-800/80 border border-zinc-700/40 text-white/90 rounded-bl-sm"
          } ${msg.isStreaming ? "after:content-['▮'] after:text-amber-400 after:animate-pulse" : ""}`}>
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-800/80 border border-zinc-700/40">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function AdminAIChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi, I'm your AI workspace advisor. You can type a question or upload an image — floor plans, product photos, competitor material, or anything you want me to analyse.",
    },
  ]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Maximum 10MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !imageFile) || isLoading) return;

    const userText = input.trim();
    const userImageUrl = imagePreview || undefined;
    const capturedFile = imageFile;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userText,
      imageUrl: userImageUrl,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    clearImage();
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", isStreaming: true }]);

    try {
      const history = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({ role: m.role, content: m.content }));

      let response: Response;

      if (capturedFile) {
        const formData = new FormData();
        formData.append("image", capturedFile);
        if (userText) formData.append("message", userText);
        formData.append("history", JSON.stringify(history));
        formData.append("pageContext", "Admin AI Chat");
        response = await fetch("/api/chat/vision", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: userText }],
            stream: true,
            pageContext: "Admin AI Chat",
          }),
        });
      }

      if (!response.ok) throw new Error("Request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.error) throw new Error(data.error);
            if (data.content) {
              fullContent += data.content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
            }
          } catch {}
        }
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent, isStreaming: false } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: "Something went wrong — please try again.", isStreaming: false }
        : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, imageFile, imagePreview, messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Chat cleared. Upload an image or type a question to start a new conversation.",
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 border border-violet-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base">AI Assistant</h1>
            <p className="text-white/40 text-xs">Vision-enabled · Upload images to analyse</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-white/40 hover:text-white/70 hover:bg-white/5"
          data-testid="button-clear-chat"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {isLoading && messages[messages.length - 1]?.isStreaming === false && <TypingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-zinc-800/60">
        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-flex mb-3">
            <img src={imagePreview} alt="Attached" className="h-20 w-auto rounded-xl border border-amber-500/30 object-cover" />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors"
              data-testid="button-remove-image"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-10 h-10 rounded-xl border border-zinc-700/60 bg-zinc-800/60 flex items-center justify-center text-white/50 hover:text-amber-300 hover:border-amber-500/40 transition-colors disabled:opacity-30 flex-shrink-0"
            data-testid="button-attach-image"
            title="Attach image"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelect}
            data-testid="input-image-file"
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={imageFile ? "Add a message about this image (optional)…" : "Ask anything — or attach an image to analyse…"}
              disabled={isLoading}
              rows={1}
              className="w-full bg-zinc-800/60 border border-zinc-700/60 text-white placeholder:text-white/25 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-500/40 focus:ring-0 disabled:opacity-40"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              data-testid="input-admin-chat"
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={sendMessage}
            disabled={(!input.trim() && !imageFile) || isLoading}
            className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black hover:bg-amber-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            data-testid="button-send-admin-chat"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-center text-white/20 text-[10px] mt-2">
          Supports images up to 10MB · PNG, JPG, WEBP, GIF · Powered by GPT-4o Vision
        </p>
      </div>
    </div>
  );
}
