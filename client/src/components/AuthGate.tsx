import { useState, type FormEvent } from "react";
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

function LoginPage() {
  const { refresh } = useAuth();
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = trpc.auth.login.useMutation({ onSuccess: async () => { await refresh(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ empCode, password }); };
  return <main className="auth-screen"><section className="auth-brand-panel"><div className="auth-brand-content"><img src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS" /><span className="auth-brand-rule" /><p className="auth-overline">FIELD OPERATIONS</p><h1>Every customer<br />connection, in view.</h1><p className="auth-brand-copy">A clear view of visits, plans and progress across the field.</p></div><small className="auth-brand-foot">CKA BIRLA GROUP · IIMS</small></section><section className="auth-form-panel"><form className="auth-card" onSubmit={submit}><div className="auth-mobile-brand"><img src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS" /></div><div className="auth-icon"><LockKeyhole size={20} /></div><p className="eyebrow">WELCOME TO FIELDDESK</p><h2>Sign in to continue</h2><p className="auth-form-copy">Use your employee code and password to access your workspace.</p><label className="auth-field"><span>Employee code</span><input autoComplete="username" value={empCode} onChange={event => setEmpCode(event.target.value)} placeholder="Enter your Emp Code" required autoFocus /></label><label className="auth-field"><span>Password</span><div className="auth-password"><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><button className="auth-submit" type="submit" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}<ArrowRight size={17} /></button><p className="auth-help">Need access? Contact your FieldDesk administrator.</p></form><small className="auth-mobile-foot">SECURE FIELD OPERATIONS WORKSPACE</small></section></main>;
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
