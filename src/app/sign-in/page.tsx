"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name } }
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Account created. Check your email to complete sign-up, then sign in.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not authenticate. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#100e17] px-4 py-12 text-white">
    <div className="mx-auto max-w-md rounded-3xl border border-[#3c3447] bg-[#191621] p-7 shadow-2xl">
      <Link href="/" className="text-xs font-bold text-[#e7bd59]">← Back to AJEY</Link>
      <div className="mt-6 text-[10px] font-extrabold tracking-[.25em] text-[#d6b45f]">LEARN · PLAN · GROW</div>
      <h1 className="mt-2 text-3xl font-black">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-sm text-[#aaa3b6]">Sign in to access your learning progress and certificates.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "signup" && <label className="block text-xs font-bold">Full name<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#403849] bg-[#100e17] px-4 py-3 text-sm outline-none" /></label>}
        <label className="block text-xs font-bold">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[#403849] bg-[#100e17] px-4 py-3 text-sm outline-none" /></label>
        <label className="block text-xs font-bold">Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#403849] bg-[#100e17] px-4 py-3 text-sm outline-none" /></label>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
        <button disabled={busy} className="gold-button w-full rounded-xl px-4 py-3 text-sm font-extrabold disabled:opacity-50">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <button onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");setMessage("");}} className="mt-5 w-full text-xs text-[#c9b9f2]">{mode==="signin"?"New to AJEY? Create an account":"Already registered? Sign in"}</button>
    </div>
  </main>;
}
