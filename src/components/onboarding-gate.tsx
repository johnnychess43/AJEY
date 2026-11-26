"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { BookOpen, Bell, CalendarDays, Check, Clock3, GraduationCap, Sparkles } from "lucide-react";

const subjects = ["Data Science", "Programming", "Business", "Mathematics", "Languages", "Personal development", "Digital skills", "Other"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function OnboardingGate() {
  const [checking, setChecking] = useState(true);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [otherSubject, setOtherSubject] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [reason, setReason] = useState("");
  const [commitment, setCommitment] = useState("5 hours");
  const [studyDays, setStudyDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [studyStyle, setStudyStyle] = useState("A mix of notes and videos");
  const [reminders, setReminders] = useState(true);
  const [reminderTime, setReminderTime] = useState("19:00");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const meta = data.user?.user_metadata ?? {};
      if (meta.onboarding_completed === false) setShow(true);
      setChecking(false);
    }).catch(() => { if (active) setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const meta = session?.user?.user_metadata ?? {};
      if (meta.onboarding_completed === false) setShow(true);
      if (!session) setShow(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  function toggleDay(day: string) {
    setStudyDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day]);
  }

  async function finish() {
    const chosenSubject = subject === "Other" ? otherSubject.trim() : subject;
    if (!chosenSubject) { setError("Choose a subject or enter what you want to learn."); setStep(1); return; }
    if (!studyDays.length) { setError("Choose at least one study day."); setStep(2); return; }
    setSaving(true); setError("");
    try {
      const supabase = createClient();
      const { data: current } = await supabase.auth.getUser();
      if (!current.user) throw new Error("Please sign in again to save your learning plan.");
      const oldMeta = current.user.user_metadata ?? {};
      const oldPreferences = oldMeta.preferences ?? {};
      const { error: updateError } = await supabase.auth.updateUser({ data: {
        onboarding_completed: true,
        onboarding: {
          subject: chosenSubject,
          level,
          reason: reason.trim(),
          weeklyCommitment: commitment,
          studyDays,
          studyStyle,
          remindersEnabled: reminders,
          reminderTime,
          timezone: "Africa/Nairobi",
          startedAt: new Date().toISOString()
        },
        preferences: {
          ...oldPreferences,
          timezone: "Africa/Nairobi",
          weeklyGoal: commitment,
          learningReminders: reminders,
          reminderDays: studyDays,
          reminderTime
        }
      }});
      if (updateError) throw updateError;
      setShow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save your learning plan. Please try again.");
    } finally { setSaving(false); }
  }

  if (checking || !show) return null;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#0b0911]/90 p-3 backdrop-blur-md sm:p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-[#4b3d59] bg-[#191521] text-white shadow-2xl">
      <div className="bg-gradient-to-r from-[#332346] via-[#4b3262] to-[#7358a0] px-6 py-6 sm:px-8">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-[.22em] text-[#f0d58f]"><Sparkles size={14}/> YOUR AJEY STARTER PLAN</div>
        <div className="flex items-center justify-between gap-4">
          <div><h1 id="welcome-title" className="text-2xl font-black sm:text-3xl">{step === 1 ? "What are you here to learn?" : "Let's make a plan that fits you."}</h1><p className="mt-2 max-w-lg text-xs leading-5 text-[#e1d7ec]">{step === 1 ? "Tell AJEY what matters to you. We'll shape your learning space around your goal." : "Choose a realistic commitment and the times you'd like to study."}</p></div>
          <div className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#f1d58c] sm:grid">{step === 1 ? <GraduationCap size={29}/> : <CalendarDays size={27}/>}</div>
        </div>
        <div className="mt-5 flex gap-2"><div className="h-1.5 flex-1 rounded-full bg-[#f0d58f]"/><div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-[#f0d58f]" : "bg-white/20"}`}/></div>
        <p className="mt-2 text-[10px] font-bold text-[#e1d7ec]">STEP {step} OF 2</p>
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8">
        {step === 1 ? <>
          <div>
            <label className="mb-3 flex items-center gap-2 text-xs font-extrabold"><BookOpen size={15} className="text-[#e8c36b]"/> What would you like to learn?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{subjects.map(item=><button type="button" key={item} onClick={()=>setSubject(item)} className={`rounded-xl border px-3 py-3 text-left text-[11px] font-bold transition ${subject===item ? "border-[#e0b94f] bg-[#4a3a22] text-[#f2d68e]" : "border-[#403749] bg-[#211c2a] text-[#d0c8dc] hover:border-[#76628e]"}`}>{item}{subject===item&&<Check size={13} className="ml-1 inline"/>}</button>)}</div>
            {subject === "Other" && <input value={otherSubject} onChange={e=>setOtherSubject(e.target.value)} placeholder="Type the subject you want to learn" className="mt-3 w-full rounded-xl border border-[#494052] bg-[#100e17] px-4 py-3 text-xs outline-none focus:border-[#d6b45f]"/>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-extrabold">Your current level<select value={level} onChange={e=>setLevel(e.target.value)} className="mt-2 w-full rounded-xl border border-[#494052] bg-[#100e17] px-3 py-3 text-xs"><option>Beginner</option><option>Some experience</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label className="block text-xs font-extrabold">What is your main reason?<select value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-[#494052] bg-[#100e17] px-3 py-3 text-xs"><option value="">Choose a goal (optional)</option><option>School or university</option><option>Career development</option><option>Prepare for an exam</option><option>Personal interest</option><option>Build a project or business</option></select></label>
          </div>
        </> : <>
          <div>
            <label className="mb-3 flex items-center gap-2 text-xs font-extrabold"><Clock3 size={15} className="text-[#e8c36b]"/> How much time can you commit each week?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{["2 hours","5 hours","7 hours","10 hours","15 hours","20+ hours"].map(item=><button type="button" key={item} onClick={()=>setCommitment(item)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${commitment===item ? "border-[#e0b94f] bg-[#4a3a22] text-[#f2d68e]" : "border-[#403749] bg-[#211c2a] text-[#d0c8dc]"}`}>{item} / week</button>)}</div>
            <p className="mt-2 text-[10px] text-[#a9a0b6]">A small, realistic commitment is better than an ambitious plan you can't maintain.</p>
          </div>
          <div>
            <label className="mb-3 block text-xs font-extrabold">Which days suit your routine?</label>
            <div className="grid grid-cols-7 gap-1.5">{days.map(day=><button type="button" key={day} onClick={()=>toggleDay(day)} className={`rounded-lg border py-3 text-[10px] font-bold ${studyDays.includes(day) ? "border-[#d6b45f] bg-[#49391f] text-[#f0d58f]" : "border-[#403749] bg-[#211c2a] text-[#bcb3c9]"}`}>{day}</button>)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-extrabold">Best time for a reminder<input type="time" value={reminderTime} onChange={e=>setReminderTime(e.target.value)} disabled={!reminders} className="mt-2 w-full rounded-xl border border-[#494052] bg-[#100e17] px-3 py-3 text-xs disabled:opacity-40"/></label>
            <label className="block text-xs font-extrabold">How do you like to learn?<select value={studyStyle} onChange={e=>setStudyStyle(e.target.value)} className="mt-2 w-full rounded-xl border border-[#494052] bg-[#100e17] px-3 py-3 text-xs"><option>A mix of notes and videos</option><option>Reading and written notes</option><option>Videos and demonstrations</option><option>Practice and exercises</option><option>Step-by-step guided lessons</option></select></label>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#494052] bg-[#211c2a] p-4 text-xs"><span className="flex items-center gap-3"><Bell size={18} className="text-[#e8c36b]"/><span><b>Enable study reminders</b><small className="mt-1 block text-[10px] text-[#a9a0b6]">Save your preferred reminder time and study days.</small></span></span><input type="checkbox" checked={reminders} onChange={e=>setReminders(e.target.checked)} className="h-4 w-4 accent-amber-400"/></label>
          <p className="text-[10px] leading-5 text-[#a9a0b6]">Reminder preferences will be saved to your account. Automatic push/email delivery will need to be connected separately.</p>
        </>}
        {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-[#403749] pt-5">
          {step === 2 ? <button type="button" onClick={()=>{setError("");setStep(1)}} className="rounded-xl border border-[#51465d] px-5 py-3 text-xs font-bold text-[#d2c8df]">Back</button> : <span className="text-[10px] text-[#a9a0b6]">You can update these choices later in Settings.</span>}
          {step === 1 ? <button type="button" onClick={()=>{if(!subject || (subject==="Other"&&!otherSubject.trim())){setError("Choose a subject or enter what you want to learn.");return;}setError("");setStep(2)}} className="rounded-xl bg-[#d6b45f] px-6 py-3 text-xs font-extrabold text-[#211a10]">Continue <span aria-hidden="true">→</span></button> : <button type="button" onClick={finish} disabled={saving} className="rounded-xl bg-[#d6b45f] px-6 py-3 text-xs font-extrabold text-[#211a10] disabled:opacity-50">{saving ? "Saving your plan…" : "Save my learning plan ✓"}</button>}
        </div>
      </div>
    </section>
  </div>;
}
