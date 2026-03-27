import { useState, useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serverLogin, checkAdminAuth } from "@/lib/adminAuth";
import { AdminLayout } from "./AdminLayout";

interface Props {
  children: React.ReactNode;
}

export function AdminAuthGate({ children }: Props) {
  const [status, setStatus] = useState<"checking" | "authed" | "login">("checking");
  const [email, setEmail] = useState("admin@thecorporatedesk.com.au");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAdminAuth().then(authenticated => {
      if (authenticated) {
        sessionStorage.setItem("tcd_admin_auth", "true");
        localStorage.setItem("tcd_admin_auth", "true");
        setStatus("authed");
      } else {
        sessionStorage.removeItem("tcd_admin_auth");
        localStorage.removeItem("tcd_admin_auth");
        setStatus("login");
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await serverLogin(email, password);
    if (ok) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      localStorage.setItem("tcd_admin_auth", "true");
      setStatus("authed");
    } else {
      setError("Invalid email or password");
    }
    setLoading(false);
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/20" />
      </div>
    );
  }

  if (status === "login") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-[hsl(43,78%,52%)] flex items-center justify-center">
              <Lock className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-white font-light text-sm tracking-widest uppercase">The Corporate Desk</div>
              <div className="text-white/30 text-xs">Admin Portal</div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              data-testid="input-admin-email"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none h-11 focus-visible:ring-0 focus-visible:border-white/30"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              data-testid="input-admin-password"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none h-11 focus-visible:ring-0 focus-visible:border-white/30"
              required
              autoFocus
            />
            {error && (
              <p className="text-red-400/80 text-xs py-1" data-testid="text-admin-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              data-testid="button-admin-login"
              className="w-full h-11 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none font-semibold text-sm tracking-wide mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <p className="text-white/15 text-xs text-center mt-8">
            Restricted access — authorised personnel only
          </p>
        </div>
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
