"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode,setMode] = useState<"login"|"signup">("signup");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    if (!supabase) { setError("AJEY authentication is not connected yet. The Supabase project and environment keys must be configured first."); setBusy(false); return; }
    try {
      if (mode === "signup") {
        const {data,error:authError} = await supabase.auth.signUp({
          email,password,options:{data:{display_name:name.trim() || "AJEY learner"}}
        });
        if (authError) throw authError;
        if (data.user && data.session) {
          await supabase.from("profiles").upsert({id:data.user.id,display_name:name.trim() || "AJEY learner"});
          router.push("/"); router.refresh();
        } else {
          setNotice("Account created. Check your email to confirm your address, then sign in.");
          setMode("login");
        }
      } else {
        const {data,error:authError} = await supabase.auth.signInWithPassword({email,password});
        if (authError) throw authError;
        if (data.user) {
          await supabase.from("profiles").upsert({id:data.user.id,display_name:data.user.user_metadata.display_name || "AJEY learner"});
        }
        router.push("/"); router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f8f7fc] lg:grid lg:grid-cols-2">
    <section className="relative hidden overflow-hidden bg-[#211d48] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#7657dd]/30 blur-3xl"/>
      <div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl font-black text-[#211d48]">A</div><span className="text-2xl font-black">AJEY</span></div>
      <div className="relative max-w-lg"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"><Sparkles size={14}/> Your personal growth companion</div><h1 className="text-5xl font-black leading-tight">Make space for what matters.</h1><p className="mt-5 max-w-md text-sm leading-7 text-white/65">Learn with curiosity. Plan with purpose. Remember what matters. Grow at your own pace.</p><div className="mt-10 grid grid-cols-2 gap-3">{["Personalized learning","Thoughtful planning","Helpful reminders","Meaningful progress"].map(x=><div key={x} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-semibold">{x}</div>)}</div></div>
      <div className="relative text-xs text-white/45">AJEY · Learn. Plan. Remember. Grow.</div>
    </section>
    <section className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-12 inline-flex items-center gap-2 text-xs font-bold text-[#85829a]"><ArrowLeft size={15}/> Back to AJEY</Link>
        <div className="mb-8 lg:hidden"><div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#211d48] text-xl font-black text-white">A</div><div className="text-2xl font-black">AJEY</div></div>
        <div className="mb-7"><div className="mb-2 text-[10px] font-extrabold tracking-[.2em] text-[#8b75dc]">WELCOME TO YOUR NEXT CHAPTER</div><h2 className="text-3xl font-black">{mode==="signup"?"Create your account":"Welcome back"}</h2><p className="mt-2 text-sm text-[#9290a7]">{mode==="signup"?"Start building a life of learning and purpose.":"Sign in to continue learning and growing."}</p></div>
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#efedf5] p-1"><button onClick={()=>setMode("signup")} className={`rounded-lg py-2.5 text-xs font-bold ${mode==="signup"?"bg-white text-[#6d53cf] shadow-sm":"text-[#85829a]"}`}>Create account</button><button onClick={()=>setMode("login")} className={`rounded-lg py-2.5 text-xs font-bold ${mode==="login"?"bg-white text-[#6d53cf] shadow-sm":"text-[#85829a]"}`}>Sign in</button></div>
        <form onSubmit={submit} className="space-y-4">
          {mode==="signup"&&<label className="block text-xs font-bold text-[#55536f]">Your name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="How should AJEY address you?" className="mt-2 w-full rounded-xl border border-[#e9e6f0] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#9c8be4]"/></label>}
          <label className="block text-xs font-bold text-[#55536f]">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-[#e9e6f0] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#9c8be4]"/></label>
          <label className="block text-xs font-bold text-[#55536f]">Password<div className="mt-2 flex rounded-xl border border-[#e9e6f0] bg-white focus-within:border-[#9c8be4]"><input required minLength={8} type={showPassword?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className="min-w-0 flex-1 rounded-xl px-4 py-3.5 text-sm outline-none"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="px-4 text-[#9290a7]">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          {notice&&<p role="status" className="rounded-xl bg-green-50 p-3 text-xs text-green-700">{notice}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#7358d6] py-4 text-sm font-extrabold text-white shadow-lg shadow-violet-200 disabled:opacity-60">{busy?"Please wait…":mode==="signup"?"Create my AJEY account":"Sign in to AJEY"}</button>
        </form>
        <div className="mt-7 flex items-center justify-center gap-2 text-[10px] text-[#aaa8b7]"><BookOpen size={13}/> Your goals. Your pace. Your progress.</div>
      </div>
    </section>
  </main>;
}
