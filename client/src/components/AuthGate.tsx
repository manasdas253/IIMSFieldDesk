import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/CurrentUserContext";
import { trpc } from "@/lib/trpc";

function clearLocalDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("ckafield.") || key.startsWith("fielddesk:") || key.startsWith("fielddesk-open-reminder:")) localStorage.removeItem(key);
    }
  } catch { /* browser storage is optional */ }
}

function MiningScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, raf = 0, width = 0, height = 0, time = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now: number) => {
      if (!ctx) return;
      time = now / 1000; ctx.clearRect(0, 0, width, height);
      const cx = width * .55, cy = height * .48, scale = Math.min(width, height) * .36;
      const project = (x: number, z: number, y: number) => {
        const a = x * Math.cos(.55 + time * .035) - z * Math.sin(.55 + time * .035);
        const b = x * Math.sin(.55 + time * .035) + z * Math.cos(.55 + time * .035);
        return [cx + a * scale, cy + (b * .42 - y) * scale] as const;
      };
      // Terraced open pit contours and fine bench lines.
      for (let ring = 0; ring < 7; ring++) {
        const radius = .18 + ring * .115;
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const angle = i / 96 * Math.PI * 2, p = project(radius * Math.cos(angle), radius * Math.sin(angle), (6-ring) * .055);
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.strokeStyle = ring < 2 ? "rgba(255,75,82,.48)" : `rgba(197,205,218,${.12 + ring * .025})`;
        ctx.lineWidth = 1; ctx.stroke();
      }
      for (let line = -6; line <= 6; line++) {
        const x = line * .12;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const z = -1.1 + i * .073, p = project(x, z, Math.max(0, .35 - Math.hypot(x,z)) * .25);
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.strokeStyle = "rgba(198,204,216,.12)"; ctx.lineWidth = .7; ctx.stroke();
      }
      // Moving haul-truck lights on a spiral haul road.
      for (let truck = 0; truck < 3; truck++) {
        const u = ((time * .055 + truck / 3) % 1);
        const angle = u * Math.PI * 6.4, radius = .83 - u * .66;
        const p = project(radius * Math.cos(angle), radius * Math.sin(angle), u * .34);
        const glow = ctx.createRadialGradient(p[0],p[1],1,p[0],p[1],12);
        glow.addColorStop(0,"rgba(255,58,68,.95)"); glow.addColorStop(1,"rgba(255,58,68,0)");
        ctx.fillStyle=glow; ctx.fillRect(p[0]-12,p[1]-12,24,24);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    resize(); draw(0);
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    if (!reduced) raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);
  return <canvas ref={ref} className="auth-mining-scene" aria-hidden="true" />;
}

function LoginPage() {
  const { refresh } = useAuth();
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const login = trpc.auth.login.useMutation({ onSuccess: async () => { await refresh(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ empCode: empCode.trim(), password }); };
  return <main className="auth-screen"><section className="auth-brand-panel"><MiningScene /><div className="auth-brand-content"><img src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS" /><span className="auth-brand-rule" /><p className="auth-overline">FIELD OPERATIONS</p><h1>Every customer connection, in view.</h1><p className="auth-brand-copy">A clear view of visits, plans and progress across the field.</p></div><small className="auth-brand-foot">CKA BIRLA GROUP · IIMS</small></section><section className="auth-form-panel"><div className="auth-cubes" aria-hidden="true"><i/><i/><i/></div><form className={`auth-card${login.isError ? " has-error" : ""}`} onSubmit={submit}><div className="auth-mobile-brand"><img src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS" /></div><div className={`auth-icon${login.isSuccess ? " is-open" : ""}`}><LockKeyhole size={25} /></div><p className="auth-kicker">WELCOME TO FIELDDESK</p><h2>Sign in to continue</h2><p className="auth-form-copy">Use your employee code and password to access your workspace.</p><label className="auth-field"><span>Employee code</span><input autoComplete="username" value={empCode} onChange={event => setEmpCode(event.target.value)} placeholder="Enter your Emp Code" required autoFocus disabled={login.isPending} /></label><label className="auth-field"><span>Password</span><div className="auth-password"><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => setCapsLock(event.getModifierState("CapsLock"))} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} placeholder="Enter your password" required disabled={login.isPending} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{capsLock && <small className="auth-caps">Caps Lock is on</small>}</label>{login.isError && <p className="auth-error" role="alert">{login.error.message}</p>}<button className="auth-submit" type="submit" disabled={login.isPending} aria-busy={login.isPending}>{login.isPending ? <><span className="auth-button-spinner"/>Signing in…</> : <>Sign in<ArrowRight size={19} /></>}</button><p className="auth-help">Need access? Contact your FieldDesk administrator.</p></form><small className="auth-mobile-foot">CKA BIRLA GROUP · IIMS</small></section></main>;
}

function PasswordDialog({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { refresh } = useAuth();
  const mutation = trpc.auth.changePassword.useMutation({ onSuccess: async () => { toast.success("Password changed."); await refresh(); onClose(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate({ currentPassword, newPassword }); };
  return <div className="auth-dialog-backdrop"><form className="auth-dialog" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={19} /></div><p className="eyebrow">ACCOUNT SECURITY</p><h2>{forced ? "Set a new password" : "Change password"}</h2><p>{forced ? "Your administrator provided a temporary password. Set a personal password to continue." : "Choose a new password for your FieldDesk account."}</p><label className="auth-field"><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></label><label className="auth-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} required /><small>Use at least 12 characters.</small></label><button className="auth-submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating…" : "Update password"}<ArrowRight size={17} /></button></form></div>;
}

export function UserMenu() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { clearLocalDrafts(); await refresh(); }, onError: error => toast.error(error.message) });
  if (!user) return null;
  return <div className="account-menu-wrap"><button type="button" className="account-menu-trigger" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="account-avatar"><UserRound size={16} /></span><span className="account-label"><strong>{user.employeeName}</strong><small>{user.role === "admin" ? "Administrator" : user.empCode}</small></span></button>{open && <div className="account-menu"><div className="account-menu-heading"><strong>{user.employeeName}</strong><small>{user.empCode} · {user.role}</small></div><button type="button" onClick={() => { setOpen(false); setChangePassword(true); }}><LockKeyhole size={15} />Change password</button><button type="button" onClick={() => { setOpen(false); logout.mutate(); }}><LogOut size={15} />Sign out</button></div>}{changePassword && <PasswordDialog forced={false} onClose={() => setChangePassword(false)} />}</div>;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading" aria-label="Loading account"><span /></div>;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <PasswordDialog forced onClose={() => undefined} />;
  return <>{children}</>;
}
