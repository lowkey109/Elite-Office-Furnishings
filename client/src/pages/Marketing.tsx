import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Send, CheckCircle2, AlertCircle, Sparkles, Copy,
  RefreshCw, Settings, ChevronRight, Eye, EyeOff, Zap, Globe,
  MessageSquare, Hash, AtSign, Phone
} from "lucide-react";
import { SiFacebook, SiInstagram, SiTelegram, SiX, SiWhatsapp } from "react-icons/si";

import { validateAdminLogin } from "@/lib/adminAuth";

type Platform = "email" | "facebook" | "instagram" | "telegram" | "twitter" | "whatsapp";

interface ChannelStatus {
  email: boolean;
  telegram: boolean;
  facebook: boolean;
  instagram: boolean;
  twitter: boolean;
  whatsapp: boolean;
}

interface GeneratedContent {
  email?: { subject: string; previewText: string; headline: string; body: string; ctaText: string; ctaUrl: string };
  facebook?: { post: string; hashtags: string[] };
  instagram?: { visualSuggestion: string; caption: string; hashtags: string[] };
  telegram?: { message: string };
  twitter?: { tweets: string[] };
  whatsapp?: { message: string };
}

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; color: string; accent: string }[] = [
  { id: "email", label: "Email", icon: <Mail className="w-5 h-5" />, color: "bg-blue-500/10 border-blue-500/25", accent: "text-blue-400" },
  { id: "facebook", label: "Facebook", icon: <SiFacebook className="w-5 h-5" />, color: "bg-[#1877F2]/10 border-[#1877F2]/25", accent: "text-[#1877F2]" },
  { id: "instagram", label: "Instagram", icon: <SiInstagram className="w-5 h-5" />, color: "bg-pink-500/10 border-pink-500/25", accent: "text-pink-400" },
  { id: "telegram", label: "Telegram", icon: <SiTelegram className="w-5 h-5" />, color: "bg-sky-500/10 border-sky-500/25", accent: "text-sky-400" },
  { id: "twitter", label: "X (Twitter)", icon: <SiX className="w-5 h-5" />, color: "bg-white/5 border-white/15", accent: "text-white" },
  { id: "whatsapp", label: "WhatsApp", icon: <SiWhatsapp className="w-5 h-5" />, color: "bg-emerald-500/10 border-emerald-500/25", accent: "text-emerald-400" },
];

const CAMPAIGN_TOPICS = [
  "New product launch — premium executive desk collection",
  "End of financial year sale & fitout special offer",
  "Office relocation & fitout services promotion",
  "Free layout plan offer — limited spots available",
  "Case study: corporate boardroom transformation",
  "ISO 9001 certified quality guarantee campaign",
  "6-year warranty — industry-leading assurance campaign",
  "Brisbane / Sydney / Melbourne expansion promotion",
  "Summer office refresh — new year new workspace",
  "Custom / enter your own topic",
];

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAdminLogin(email, pw)) {
      sessionStorage.setItem("mkt_auth", "1");
      sessionStorage.setItem("tcd_admin_auth", "true");
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-[hsl(43,78%,60%)]" />
          </div>
          <h1 className="text-xl font-serif font-bold text-white">Marketing Hub</h1>
          <p className="text-white/40 text-sm mt-1">The Corporate Desk — Admin Access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-white/60 mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@thecorporatedesk.com.au"
              className="w-full h-12 px-4 rounded-xl bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.2)] text-white text-base outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
              style={{ fontSize: "16px" }}
              autoFocus
              data-testid="input-marketing-email"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter password"
              className={`w-full h-12 px-4 rounded-xl bg-[hsl(220,18%,11%)] border ${error ? "border-red-500/50 text-red-400" : "border-[rgba(201,168,76,0.2)]"} text-white text-base outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors`}
              style={{ fontSize: "16px" }}
              data-testid="input-marketing-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">Incorrect credentials. Please try again.</p>}
          <Button type="submit" className="w-full h-12 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none text-base" data-testid="button-marketing-login">
            Enter Hub
          </Button>
        </form>
      </div>
    </div>
  );
}

function ChannelCard({
  platform,
  isConnected,
  content,
  onGenerate,
  onPost,
  isGenerating,
  isPosting,
  extraInputs,
  setExtraInputs,
}: {
  platform: typeof PLATFORMS[0];
  isConnected: boolean;
  content: GeneratedContent;
  onGenerate: (id: Platform) => void;
  onPost: (id: Platform, extra?: Record<string, string>) => void;
  isGenerating: boolean;
  isPosting: boolean;
  extraInputs: Record<string, string>;
  setExtraInputs: (v: Record<string, string>) => void;
}) {
  const { toast } = useToast();
  const [showContent, setShowContent] = useState(true);
  const platformContent = content[platform.id];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: "Content ready to paste." });
  };

  const renderContent = () => {
    if (!platformContent) return null;

    if (platform.id === "email") {
      const c = platformContent as NonNullable<GeneratedContent["email"]>;
      return (
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Subject Line</p>
            <p className="text-white font-medium">{c.subject}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Preview Text</p>
            <p className="text-white/70">{c.previewText}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Headline</p>
            <p className="text-white font-semibold">{c.headline}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Body Copy</p>
            <p className="text-white/80 whitespace-pre-wrap">{c.body}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">CTA Button</p>
            <p className="text-[hsl(43,78%,65%)] font-semibold">{c.ctaText} → {c.ctaUrl}</p>
          </div>
        </div>
      );
    }

    if (platform.id === "twitter") {
      const c = platformContent as NonNullable<GeneratedContent["twitter"]>;
      return (
        <div className="space-y-2">
          {(c.tweets || []).map((tweet, i) => (
            <div key={i} className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Tweet {i + 1}{i > 0 ? " (reply)" : " (hook)"}</p>
                  <p className="text-white/85 text-sm whitespace-pre-wrap">{tweet}</p>
                  <p className={`text-xs mt-1 ${tweet.length > 260 ? "text-red-400" : "text-white/30"}`}>{tweet.length}/280</p>
                </div>
                <button onClick={() => copyToClipboard(tweet)} className="flex-shrink-0 p-1.5 rounded text-white/30 hover:text-white/60">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (platform.id === "instagram") {
      const c = platformContent as NonNullable<GeneratedContent["instagram"]>;
      return (
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-pink-500/15">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Visual Suggestion</p>
            <p className="text-white/70 italic">{c.visualSuggestion}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Caption</p>
            <p className="text-white/85 whitespace-pre-wrap">{c.caption}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Hashtags</p>
            <p className="text-pink-400 text-xs leading-loose">{(c.hashtags || []).join(" ")}</p>
          </div>
        </div>
      );
    }

    const simpleContent =
      platform.id === "facebook" ? (platformContent as any).post :
      platform.id === "telegram" ? (platformContent as any).message :
      platform.id === "whatsapp" ? (platformContent as any).message : "";

    const hashtags = platform.id === "facebook" ? (platformContent as any).hashtags : [];

    return (
      <div className="space-y-3 text-sm">
        <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
          <p className="text-white/85 whitespace-pre-wrap">{simpleContent}</p>
        </div>
        {hashtags?.length > 0 && (
          <div className="p-3 rounded-lg bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.1)]">
            <p className="text-[hsl(43,78%,65%)] text-xs">{hashtags.join(" ")}</p>
          </div>
        )}
      </div>
    );
  };

  const getFullText = () => {
    if (!platformContent) return "";
    if (platform.id === "email") {
      const c = platformContent as NonNullable<GeneratedContent["email"]>;
      return `Subject: ${c.subject}\nPreview: ${c.previewText}\n\n${c.headline}\n\n${c.body}\n\n${c.ctaText}: ${c.ctaUrl}`;
    }
    if (platform.id === "twitter") {
      return (platformContent as NonNullable<GeneratedContent["twitter"]>).tweets?.join("\n\n") || "";
    }
    if (platform.id === "instagram") {
      const c = platformContent as NonNullable<GeneratedContent["instagram"]>;
      return `${c.caption}\n\n${(c.hashtags || []).join(" ")}`;
    }
    if (platform.id === "facebook") return `${(platformContent as any).post}\n\n${(platformContent as any).hashtags?.join(" ") || ""}`;
    return (platformContent as any).message || "";
  };

  return (
    <div className={`rounded-2xl border ${platform.color} bg-[hsl(220,18%,9%)] overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className={platform.accent}>{platform.icon}</span>
          <span className="text-white font-semibold text-sm">{platform.label}</span>
          {isConnected ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] py-0 px-2">Connected</Badge>
          ) : (
            <Badge className="bg-white/5 text-white/30 border-white/10 text-[10px] py-0 px-2">Setup required</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {platformContent && (
            <>
              <button onClick={() => copyToClipboard(getFullText())} className="p-1.5 rounded text-white/30 hover:text-white/60 transition-colors" title="Copy all">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowContent(!showContent)} className="p-1.5 rounded text-white/30 hover:text-white/60 transition-colors">
                {showContent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {platform.id === "email" && (
          <input
            type="text"
            placeholder="Recipient email(s) — comma separated"
            value={extraInputs.emailTo || ""}
            onChange={(e) => setExtraInputs({ ...extraInputs, emailTo: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-[hsl(220,18%,11%)] border border-white/10 text-white text-sm placeholder-white/30 outline-none focus:border-[rgba(201,168,76,0.3)]"
            style={{ fontSize: "16px" }}
          />
        )}
        {platform.id === "whatsapp" && (
          <input
            type="text"
            placeholder="Recipient phone — e.g. 61412345678"
            value={extraInputs.whatsappTo || ""}
            onChange={(e) => setExtraInputs({ ...extraInputs, whatsappTo: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-[hsl(220,18%,11%)] border border-white/10 text-white text-sm placeholder-white/30 outline-none focus:border-[rgba(201,168,76,0.3)]"
            style={{ fontSize: "16px" }}
          />
        )}
        {platform.id === "instagram" && (
          <input
            type="text"
            placeholder="Image URL (required for Instagram posts)"
            value={extraInputs.instagramImageUrl || ""}
            onChange={(e) => setExtraInputs({ ...extraInputs, instagramImageUrl: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-[hsl(220,18%,11%)] border border-white/10 text-white text-sm placeholder-white/30 outline-none focus:border-[rgba(201,168,76,0.3)]"
            style={{ fontSize: "16px" }}
          />
        )}

        {platformContent && showContent && renderContent()}

        {!platformContent && (
          <div className="py-6 text-center">
            <p className="text-white/25 text-xs">Generate content above, then post here</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => onGenerate(platform.id)}
            disabled={isGenerating}
            size="sm"
            variant="outline"
            className="flex-1 border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] bg-transparent hover:bg-[rgba(201,168,76,0.06)] text-xs h-9"
            style={{ touchAction: "manipulation" }}
            data-testid={`btn-generate-${platform.id}`}
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Generate
          </Button>
          <Button
            onClick={() => onPost(platform.id, extraInputs)}
            disabled={isPosting || !platformContent || (!isConnected && platform.id !== "email")}
            size="sm"
            className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] border-none font-semibold text-xs h-9 disabled:opacity-40"
            style={{ touchAction: "manipulation" }}
            data-testid={`btn-post-${platform.id}`}
          >
            {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            {isConnected ? "Send / Post" : "Copy & Post"}
          </Button>
        </div>
        {!isConnected && (
          <p className="text-white/30 text-[10px] text-center -mt-2">
            Configure API credentials in Settings to enable direct posting
          </p>
        )}
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const SETTINGS_GROUPS = [
    {
      label: "Email (SMTP)",
      icon: <Mail className="w-4 h-4" />,
      keys: [
        { key: "SMTP_HOST", placeholder: "smtp.gmail.com or smtp.sendgrid.net", label: "SMTP Host" },
        { key: "SMTP_PORT", placeholder: "587", label: "SMTP Port" },
        { key: "SMTP_USER", placeholder: "your@email.com", label: "SMTP Username" },
        { key: "SMTP_PASS", placeholder: "password or API key", label: "SMTP Password / API Key", secret: true },
        { key: "EMAIL_FROM", placeholder: "The Corporate Desk <noreply@thecorporatedesk.com.au>", label: "From Address" },
      ],
    },
    {
      label: "Telegram",
      icon: <SiTelegram className="w-4 h-4" />,
      keys: [
        { key: "TELEGRAM_BOT_TOKEN", placeholder: "123456789:ABCdef...", label: "Bot Token", secret: true },
        { key: "TELEGRAM_CHANNEL_ID", placeholder: "@yourchannel or -100xxxxxxxxx", label: "Channel ID / Username" },
      ],
    },
    {
      label: "Facebook & Instagram",
      icon: <SiFacebook className="w-4 h-4" />,
      keys: [
        { key: "FACEBOOK_PAGE_ACCESS_TOKEN", placeholder: "EAAxxxx...", label: "Page Access Token", secret: true },
        { key: "FACEBOOK_PAGE_ID", placeholder: "123456789012345", label: "Facebook Page ID" },
        { key: "INSTAGRAM_BUSINESS_ACCOUNT_ID", placeholder: "987654321098765", label: "Instagram Business Account ID" },
      ],
    },
    {
      label: "X / Twitter",
      icon: <SiX className="w-4 h-4" />,
      keys: [
        { key: "TWITTER_API_KEY", placeholder: "API Key", label: "API Key", secret: true },
        { key: "TWITTER_API_SECRET", placeholder: "API Secret", label: "API Key Secret", secret: true },
        { key: "TWITTER_ACCESS_TOKEN", placeholder: "Access Token", label: "Access Token", secret: true },
        { key: "TWITTER_ACCESS_TOKEN_SECRET", placeholder: "Access Token Secret", label: "Access Token Secret", secret: true },
      ],
    },
    {
      label: "WhatsApp Business",
      icon: <SiWhatsapp className="w-4 h-4" />,
      keys: [
        { key: "WHATSAPP_API_TOKEN", placeholder: "Bearer token from Meta Cloud API", label: "API Token", secret: true },
        { key: "WHATSAPP_PHONE_NUMBER_ID", placeholder: "Phone number ID from Meta dashboard", label: "Phone Number ID" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)]">
        <p className="text-[hsl(43,78%,65%)] text-sm font-semibold mb-2">How to configure API credentials</p>
        <p className="text-white/50 text-xs leading-relaxed">
          Set each key as an environment variable (secret) in your Replit project settings. Once set, the channel will show as "Connected" and direct posting will be enabled. Contact your developer or Replit support for help adding secrets.
        </p>
      </div>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label} className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[hsl(220,18%,9%)] border-b border-white/5">
            <span className="text-white/50">{group.icon}</span>
            <span className="text-white/80 font-semibold text-sm">{group.label}</span>
          </div>
          <div className="p-4 space-y-2 bg-[hsl(220,18%,8%)]">
            {group.keys.map((item) => (
              <div key={item.key}>
                <label className="text-white/40 text-[10px] uppercase tracking-wide mb-1 block">{item.label}</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center h-10 px-3 rounded-lg bg-[hsl(220,18%,11%)] border border-white/8">
                    <code className="text-white/30 text-xs font-mono truncate">{item.key}</code>
                  </div>
                  {item.secret && (
                    <div className="h-10 px-3 rounded-lg bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] flex items-center">
                      <span className="text-[hsl(43,78%,52%)] text-xs">Secret</span>
                    </div>
                  )}
                </div>
                <p className="text-white/25 text-[10px] mt-1 ml-1">e.g. {item.placeholder}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="p-4 rounded-xl bg-[hsl(220,18%,9%)] border border-white/8">
        <p className="text-white/50 text-xs leading-relaxed">
          <strong className="text-white/70">Security note:</strong> All API tokens should be set as secrets, not hard-coded. Each platform requires a developer account. See platform-specific developer documentation for obtaining access tokens.
        </p>
      </div>
    </div>
  );
}

export default function Marketing() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "settings">("generate");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [customBrief, setCustomBrief] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["email", "facebook", "instagram", "telegram", "twitter", "whatsapp"]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>({
    email: false, telegram: false, facebook: false, instagram: false, twitter: false, whatsapp: false,
  });
  const [generatingPlatforms, setGeneratingPlatforms] = useState<Set<Platform>>(new Set());
  const [postingPlatforms, setPostingPlatforms] = useState<Set<Platform>>(new Set());
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sessionStorage.getItem("mkt_auth") === "1") setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/marketing/status")
        .then((r) => r.json())
        .then((data) => { if (data.channels) setChannelStatus(data.channels); })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;

  const effectiveTopic = topic === "Custom / enter your own topic" ? customTopic : topic;

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generateAll = async () => {
    if (!effectiveTopic) {
      toast({ title: "Select a campaign topic first", variant: "destructive" });
      return;
    }
    const platforms = selectedPlatforms;
    setGeneratingPlatforms(new Set(platforms));

    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const res = await fetch("/api/marketing/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, topic: effectiveTopic, tone, customBrief }),
          });
          const data = await res.json();
          if (data.success) {
            setGeneratedContent((prev) => ({ ...prev, [platform]: data.content }));
          }
        } catch (_) {}
        setGeneratingPlatforms((prev) => { const next = new Set(prev); next.delete(platform); return next; });
      })
    );
    toast({ title: "Content generated for all channels", description: "Review and post when ready." });
  };

  const generateSingle = async (platform: Platform) => {
    if (!effectiveTopic) {
      toast({ title: "Select a topic first", variant: "destructive" });
      return;
    }
    setGeneratingPlatforms((prev) => new Set([...prev, platform]));
    try {
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic: effectiveTopic, tone, customBrief }),
      });
      const data = await res.json();
      if (data.success) setGeneratedContent((prev) => ({ ...prev, [platform]: data.content }));
      else toast({ title: "Generation failed", description: data.error, variant: "destructive" });
    } catch (_) {
      toast({ title: "Network error", variant: "destructive" });
    }
    setGeneratingPlatforms((prev) => { const next = new Set(prev); next.delete(platform); return next; });
  };

  const postToChannel = async (platform: Platform, extra?: Record<string, string>) => {
    const safeExtra = extra ?? {};
    const content = generatedContent[platform];
    if (!content) return;

    if (!channelStatus[platform]) {
      const text =
        platform === "email" ? (content as any).body :
        platform === "twitter" ? (content as any).tweets?.join("\n\n") :
        platform === "instagram" ? `${(content as any).caption}\n\n${(content as any).hashtags?.join(" ")}` :
        platform === "facebook" ? `${(content as any).post}\n\n${(content as any).hashtags?.join(" ")}` :
        (content as any).message || "";
      navigator.clipboard.writeText(text);
      toast({ title: `Copied ${platform} content`, description: "Configure API credentials to enable direct posting." });
      return;
    }

    setPostingPlatforms((prev) => new Set([...prev, platform]));
    try {
      let body: Record<string, any> = {};
      let endpoint = `/api/marketing/${platform}`;

      if (platform === "email") {
        const c = content as NonNullable<GeneratedContent["email"]>;
        const htmlBody = `<h1 style="color:#fff;font-family:Georgia,serif;font-size:28px;margin-bottom:16px">${c.headline}</h1><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7">${c.body.replace(/\n/g, "<br>")}</div><div style="text-align:center;margin:32px 0"><a href="${c.ctaUrl}" style="background:#C9A84C;color:#0d0f14;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">${c.ctaText}</a></div>`;
        body = { to: (safeExtra.emailTo || "").split(",").map((s: string) => s.trim()).filter(Boolean), subject: c.subject, htmlBody, previewText: c.previewText };
      } else if (platform === "facebook") {
        const c = content as NonNullable<GeneratedContent["facebook"]>;
        body = { message: `${c.post}\n\n${c.hashtags?.join(" ") || ""}`, link: "https://thecorporatedesk.com.au" };
      } else if (platform === "instagram") {
        const c = content as NonNullable<GeneratedContent["instagram"]>;
        body = { caption: `${c.caption}\n\n${c.hashtags?.join(" ") || ""}`, imageUrl: safeExtra.instagramImageUrl || "" };
      } else if (platform === "telegram") {
        body = { message: (content as NonNullable<GeneratedContent["telegram"]>).message };
      } else if (platform === "twitter") {
        body = { tweets: (content as NonNullable<GeneratedContent["twitter"]>).tweets };
      } else if (platform === "whatsapp") {
        body = { message: (content as NonNullable<GeneratedContent["whatsapp"]>).message, to: safeExtra.whatsappTo || "" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: `Posted to ${platform}`, description: "Content published successfully." });
      } else {
        toast({ title: `Failed to post to ${platform}`, description: data.error || "Check configuration.", variant: "destructive" });
      }
    } catch (_) {
      toast({ title: "Network error", variant: "destructive" });
    }
    setPostingPlatforms((prev) => { const next = new Set(prev); next.delete(platform); return next; });
  };

  const connectedCount = Object.values(channelStatus).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      <header className="sticky top-0 z-10 bg-[hsl(220,18%,7%)]/95 backdrop-blur border-b border-[rgba(201,168,76,0.12)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[hsl(43,78%,60%)]" />
            </div>
            <div>
              <span className="text-white font-semibold text-sm">Marketing Hub</span>
              <span className="ml-2 text-white/30 text-xs hidden sm:inline">The Corporate Desk</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-[10px] ${connectedCount > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/30 border-white/10"}`}>
              {connectedCount}/{PLATFORMS.length} channels live
            </Badge>
            <div className="flex bg-[hsl(220,18%,10%)] rounded-lg p-0.5 border border-white/8">
              <button
                onClick={() => setActiveTab("generate")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "generate" ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)]" : "text-white/40 hover:text-white/60"}`}
                style={{ touchAction: "manipulation" }}
                data-testid="tab-generate"
              >
                <Sparkles className="w-3 h-3 inline mr-1" />Generate
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "settings" ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)]" : "text-white/40 hover:text-white/60"}`}
                style={{ touchAction: "manipulation" }}
                data-testid="tab-settings"
              >
                <Settings className="w-3 h-3 inline mr-1" />Setup
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "generate" ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[rgba(201,168,76,0.18)] bg-[hsl(220,18%,8%)] p-5 space-y-5">
              <div>
                <h2 className="text-white font-semibold mb-1">Campaign Brief</h2>
                <p className="text-white/40 text-xs">Select a topic and the AI will generate tailored content for every channel simultaneously</p>
              </div>

              <div>
                <label className="text-white/50 text-xs uppercase tracking-wide mb-2 block">Campaign Topic</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CAMPAIGN_TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                        topic === t
                          ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] text-[hsl(43,78%,65%)]"
                          : "border-white/8 bg-[hsl(220,18%,10%)] text-white/50 hover:border-white/15 hover:text-white/70"
                      }`}
                      style={{ touchAction: "manipulation", minHeight: "44px" }}
                      data-testid={`topic-${t.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {topic === t && <ChevronRight className="w-3 h-3 inline mr-1" />}{t}
                    </button>
                  ))}
                </div>
                {topic === "Custom / enter your own topic" && (
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Describe your campaign..."
                    className="mt-3 w-full h-11 px-4 rounded-xl bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.25)] text-white text-sm placeholder-white/30 outline-none"
                    style={{ fontSize: "16px" }}
                    data-testid="input-custom-topic"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wide mb-2 block">Tone of Voice</label>
                  <div className="flex flex-wrap gap-2">
                    {["professional", "bold & direct", "warm & friendly", "urgent", "exclusive"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${tone === t ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)]" : "bg-white/5 text-white/40 border border-white/8 hover:text-white/60"}`}
                        style={{ touchAction: "manipulation", minHeight: "36px" }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wide mb-2 block">Extra Brief (optional)</label>
                  <textarea
                    value={customBrief}
                    onChange={(e) => setCustomBrief(e.target.value)}
                    placeholder="Any specific angles, offers, or requirements..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[hsl(220,18%,11%)] border border-white/8 text-white text-xs placeholder-white/25 outline-none resize-none focus:border-[rgba(201,168,76,0.3)]"
                    rows={3}
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-white/50 text-xs uppercase tracking-wide mb-2 block">Generate For</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        selectedPlatforms.includes(p.id)
                          ? "bg-[rgba(201,168,76,0.1)] border-[rgba(201,168,76,0.3)] text-white"
                          : "bg-transparent border-white/8 text-white/30"
                      }`}
                      style={{ touchAction: "manipulation", minHeight: "36px" }}
                      data-testid={`toggle-${p.id}`}
                    >
                      <span className={selectedPlatforms.includes(p.id) ? p.accent : "text-white/20"}>{p.icon}</span>
                      {p.label}
                      {selectedPlatforms.includes(p.id) && <CheckCircle2 className="w-3 h-3 text-[hsl(43,78%,52%)]" />}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generateAll}
                disabled={generatingPlatforms.size > 0 || !effectiveTopic}
                className="w-full h-12 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none text-base disabled:opacity-50"
                style={{ touchAction: "manipulation" }}
                data-testid="btn-generate-all"
              >
                {generatingPlatforms.size > 0 ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Generating {selectedPlatforms.length} channels...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Generate All Channel Content</>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((platform) => (
                <ChannelCard
                  key={platform.id}
                  platform={platform}
                  isConnected={channelStatus[platform.id]}
                  content={generatedContent}
                  onGenerate={generateSingle}
                  onPost={postToChannel}
                  isGenerating={generatingPlatforms.has(platform.id)}
                  isPosting={postingPlatforms.has(platform.id)}
                  extraInputs={extraInputs}
                  setExtraInputs={setExtraInputs}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-white font-semibold text-lg mb-1">Channel Configuration</h2>
              <p className="text-white/40 text-sm">Connect each platform to enable direct posting from the Marketing Hub</p>
            </div>
            <SettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
