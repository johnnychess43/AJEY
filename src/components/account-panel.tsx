"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { CircleUserRound, LockKeyhole, LogOut, Save, Settings2, ShieldCheck, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type Preferences = {
  appearance: "dark" | "light" | "system";
  language: "English" | "Kiswahili";
  timezone: string;
  weeklyGoal: string;
  learningReminders: boolean;
  emailUpdates: boolean;
};
const defaults: Preferences = {
  appearance: "dark", language: "English", timezone: "Africa/Nairobi",
  weeklyGoal: "5 hours", learningReminders: true, emailUpdates: false,
};

export default function AccountPanel({ mode }: { mode: "profile" | "settings" }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const current = data.user;
      setUser(current);
      const meta = current?.user_metadata ?? {};
      setFullName(meta.full_name ?? "");
      setUsername(meta.username ?? "");
      setBio(meta.bio ?? "");
      setAvatarUrl(meta.avatar_url ?? "");
      setPreferences({ ...defaults, ...(meta.preferences ?? {}) });
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const current = session?.user ?? null;
      setUser(current);
      if (current) {
        const meta = current.user_metadata ?? {};
        setFullName(meta.full_name ?? "");
        setUsername(meta.username ?? "");
        setBio(meta.bio ?? "");
        setAvatarUrl(meta.avatar_url ?? "");
        setPreferences({ ...defaults, ...(meta.preferences ?? {}) });
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const apply = () => {
      const mode = preferences.appearance;
      const resolved = mode === "system"
        ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : mode;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
  }, [preferences.appearance]);

  async function saveProfile() {
    setSaving(true); setNotice(""); setError("");
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), username: username.trim(), bio: bio.trim(), avatar_url: avatarUrl.trim(), preferences }
      });
      if (updateError) throw updateError;
      setUser(data.user);
      setNotice("Your changes have been saved to your AJEY account.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your changes.");
    } finally { setSaving(false); }
  }

  async function changePassword() {
    if (newPassword.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    setSaving(true); setNotice(""); setError("");
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setNotice("Your password has been updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your password.");
    } finally { setSaving(false); }
  }

  if (loading) return <section className="panel max-w-3xl p-6"><p className="text-sm text-[#aaa1b4]">Loading your account…</p></section>;

  if (!user) return <section className="panel max-w-3xl p-6">
    <div className="flex items-center gap-3"><CircleUserRound className="text-[#e7bd59]" size={28}/><div><h1 className="text-xl font-black">Your AJEY account</h1><p className="mt-1 text-xs text-[#aaa1b4]">Sign in to create your profile and save your personal settings.</p></div></div>
    <a href="/sign-in" className="gold-button mt-6 inline-flex rounded-xl px-5 py-3 text-xs font-extrabold">Sign in or create account</a>
  </section>;

  const avatar = avatarUrl || "";
  return <div className="max-w-4xl space-y-5">
    <section className="panel overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-[#38274d] via-[#7454a0] to-[#b38b48]"/>
      <div className="px-5 pb-6 md:px-7">
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-[#1b1723] bg-[#302744] text-2xl font-black text-[#f1d27c]">
            {avatar ? <img src={avatar} alt="Profile avatar" className="h-full w-full object-cover"/> : (fullName.trim()[0] || user.email?.[0] || "A").toUpperCase()}
          </div>
          <div className="pb-1 text-right"><span className="rounded-full border border-[#d6a83d]/30 bg-[#d6a83d]/10 px-3 py-1 text-[10px] font-bold text-[#e9c66d]">AJEY MEMBER</span></div>
        </div>
        <h1 className="mt-3 text-2xl font-black">{mode === "profile" ? "Your profile" : "Account settings"}</h1>
        <p className="mt-1 text-xs text-[#aaa1b4]">{user.email} · Personal learning workspace</p>
      </div>
    </section>

    {mode === "profile" ? <section className="panel p-5 md:p-7">
      <div className="mb-5 flex items-center gap-2"><UserRound className="text-[#e7bd59]"/><h2 className="font-extrabold">Personal information</h2></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs font-bold">Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"/></label>
        <label className="block text-xs font-bold">Username<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. ajey_learner" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"/></label>
        <label className="block text-xs font-bold md:col-span-2">Profile photo URL<input value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)} placeholder="Paste a public image URL" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"/></label>
        <label className="block text-xs font-bold md:col-span-2">About you<textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} maxLength={240} placeholder="Tell AJEY a little about your interests and goals…" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"/></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-[#aaa1b4]">Your email address is managed securely by Supabase Auth.</p><button onClick={saveProfile} disabled={saving} className="gold-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold"><Save size={14}/>{saving ? "Saving…" : "Save profile"}</button></div>
    </section> : <>
      <section className="panel p-5 md:p-7">
        <div className="mb-5 flex items-center gap-2"><Settings2 className="text-[#e7bd59]"/><h2 className="font-extrabold">Personalise your experience</h2></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs font-bold">Appearance<select value={preferences.appearance} onChange={e=>setPreferences(p=>({...p,appearance:e.target.value as Preferences["appearance"]}))} className="mt-2 w-full rounded-xl border bg-[#17131f] px-4 py-3 text-sm"><option value="dark">Dark</option><option value="light">Light</option><option value="system">Use device setting</option></select></label>
          <label className="block text-xs font-bold">Language<select value={preferences.language} onChange={e=>setPreferences(p=>({...p,language:e.target.value as Preferences["language"]}))} className="mt-2 w-full rounded-xl border bg-[#17131f] px-4 py-3 text-sm"><option>English</option><option>Kiswahili</option></select></label>
          <label className="block text-xs font-bold">Timezone<select value={preferences.timezone} onChange={e=>setPreferences(p=>({...p,timezone:e.target.value}))} className="mt-2 w-full rounded-xl border bg-[#17131f] px-4 py-3 text-sm"><option value="Africa/Nairobi">East Africa Time (Nairobi)</option><option value="UTC">UTC</option><option value="Africa/London">United Kingdom (London)</option><option value="America/New_York">Eastern Time (New York)</option></select></label>
          <label className="block text-xs font-bold">Weekly learning goal<select value={preferences.weeklyGoal} onChange={e=>setPreferences(p=>({...p,weeklyGoal:e.target.value}))} className="mt-2 w-full rounded-xl border bg-[#17131f] px-4 py-3 text-sm"><option>3 hours</option><option>5 hours</option><option>7 hours</option><option>10 hours</option><option>15 hours</option></select></label>
        </div>
        <div className="mt-5 space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#3b3347] p-4 text-xs"><span><b>Learning reminders</b><small className="mt-1 block text-[#aaa1b4]">Receive reminders to keep your study routine.</small></span><input type="checkbox" checked={preferences.learningReminders} onChange={e=>setPreferences(p=>({...p,learningReminders:e.target.checked}))} className="h-4 w-4 accent-amber-400"/></label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#3b3347] p-4 text-xs"><span><b>Product and learning updates</b><small className="mt-1 block text-[#aaa1b4]">Allow occasional AJEY email updates.</small></span><input type="checkbox" checked={preferences.emailUpdates} onChange={e=>setPreferences(p=>({...p,emailUpdates:e.target.checked}))} className="h-4 w-4 accent-amber-400"/></label>
        </div>
        <div className="mt-5 flex justify-end"><button onClick={saveProfile} disabled={saving} className="gold-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold"><Save size={14}/>{saving ? "Saving…" : "Save preferences"}</button></div>
      </section>
      <section className="panel p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2"><LockKeyhole className="text-[#e7bd59]"/><h2 className="font-extrabold">Security and password</h2></div>
        <label className="block text-xs font-bold">New password<input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm md:max-w-md"/></label>
        <button onClick={changePassword} disabled={saving || !newPassword} className="mt-4 rounded-xl border border-[#d6a83d]/40 px-4 py-3 text-xs font-bold text-[#f0d28a] disabled:opacity-50">Update password</button>
      </section>
      <section className="panel p-5 md:p-7">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="text-[#e7bd59]"/><h2 className="font-extrabold">Privacy and account</h2></div>
        <p className="text-xs leading-6 text-[#aaa1b4]">Your profile details and preferences are stored in your Supabase account metadata. These fields are for personalisation only and are not used to grant access or permissions.</p>
        <button onClick={async()=>{await createClient().auth.signOut();window.location.href="/";}} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rose-400/30 px-4 py-3 text-xs font-bold text-rose-300"><LogOut size={14}/>Sign out of AJEY</button>
      </section>
    </>}
    {(notice || error) && <p role="status" className={error ? "text-xs text-rose-300" : "text-xs text-emerald-300"}>{error || notice}</p>}
  </div>;
}
