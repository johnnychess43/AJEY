"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ExternalLink, LoaderCircle, LockKeyhole } from "lucide-react";

type Certificate = { id: string; course_slug: string; certificate_number: string; issued_at: string };
type Data = {
  certificates: Certificate[];
  progress: { course_slug: string; progress_percent: number }[];
  prices: { KES: number | null; USD: number | null };
};
const courses = [
  { slug: "foundations-of-data-science", name: "Foundations of Data Science" },
  { slug: "programming-with-python", name: "Programming with Python" },
  { slug: "learning-how-to-learn", name: "Learning how to learn" }
];

export default function CertificatesPanel() {
  const [data,setData]=useState<Data|null>(null);
  const [currency,setCurrency]=useState<"KES"|"USD">("KES");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [signedOut,setSignedOut]=useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/certificates",{cache:"no-store"});
      const result=await response.json();
      if(response.status===401){setSignedOut(true);return;}
      if(!response.ok)throw new Error(result.error||"Could not load certificates.");
      setData(result);
    } catch(e) {setError(e instanceof Error?e.message:"Could not load certificates.");}
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  async function checkout(courseSlug:string) {
    setBusy(courseSlug);setError("");
    try {
      const response=await fetch("/api/payments/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseSlug,currency})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not start checkout.");
      window.location.assign(result.checkoutUrl);
    } catch(e) {setError(e instanceof Error?e.message:"Could not start checkout.");setBusy("");}
  }

  if(loading)return <section className="panel p-6 text-sm text-[#aaa3b6]"><LoaderCircle className="mr-2 inline animate-spin"/> Loading your certificates…</section>;
  if(signedOut)return <section className="panel max-w-2xl p-7"><Award className="mb-4 text-[#d6b45f]" size={30}/><h1 className="text-2xl font-black">Your AJEY certificates</h1><p className="mt-2 text-sm leading-6 text-[#aaa3b6]">Sign in or create a learner account to track completed courses, make certificate payments and access issued certificates.</p><Link href="/sign-in?next=/" className="gold-button mt-5 inline-flex rounded-xl px-5 py-3 text-xs font-extrabold">Sign in / Create account</Link></section>;

  const owned = new Map((data?.certificates??[]).map(c=>[c.course_slug,c]));
  const progress = new Map((data?.progress??[]).map(p=>[p.course_slug,p.progress_percent]));
  const price=data?.prices[currency]??null;

  return <section className="space-y-5">
    <div className="panel flex flex-wrap items-end justify-between gap-4 p-6">
      <div><div className="mb-2 text-[10px] font-extrabold tracking-[.2em] text-[#d6b45f]">ACHIEVEMENT CENTRE</div><h1 className="text-2xl font-black">Earn your certificate.</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-[#aaa3b6]">Complete a learning path, pay securely, and receive a verifiable AJEY certificate automatically.</p></div>
      <div className="flex items-center gap-2 rounded-xl border border-[#49404f] bg-[#17141f] p-1"><button onClick={()=>setCurrency("KES")} className={`rounded-lg px-3 py-2 text-xs font-bold ${currency==="KES"?"bg-[#d6b45f] text-[#17141f]":"text-[#c5bdcf]"}`}>KES</button><button onClick={()=>setCurrency("USD")} className={`rounded-lg px-3 py-2 text-xs font-bold ${currency==="USD"?"bg-[#d6b45f] text-[#17141f]":"text-[#c5bdcf]"}`}>USD</button></div>
    </div>
    {error&&<div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-xs text-rose-200">{error}</div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map(course=>{
        const percent=progress.get(course.slug)??0;
        const certificate=owned.get(course.slug);
        const complete=percent>=100;
        return <article key={course.slug} className="panel p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#d6b45f]/10 text-[#e7c76c]"><Award/></div>
          <h2 className="font-extrabold">{course.name}</h2>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#aaa3b6]"><span>Course progress</span><b>{percent}%</b></div>
          <div className="mt-2 h-2 rounded-full bg-[#393344]"><div className="h-2 rounded-full bg-[#d6b45f]" style={{width:`${Math.min(100,percent)}%`}}/></div>
          {certificate ? <div className="mt-5 space-y-2"><p className="text-xs font-bold text-emerald-300">Certificate issued · {certificate.certificate_number}</p><Link href={`/certificates/${certificate.id}`} className="inline-flex items-center gap-2 text-xs font-bold text-[#e7c76c]">View certificate <ExternalLink size={13}/></Link></div>
          : <div className="mt-5">{complete ? <><p className="mb-3 text-xs text-[#aaa3b6]">Certificate fee: {price===null?"Not configured":currency==="KES"?`KES ${price.toLocaleString("en-KE")}`:`USD $${price.toFixed(2)}`}</p><button disabled={busy===course.slug||price===null} onClick={()=>void checkout(course.slug)} className="gold-button w-full rounded-xl px-4 py-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-40">{busy===course.slug?"Starting secure checkout…":price===null?"Payments being configured":"Get certificate"}</button></>
          : <p className="flex items-center gap-2 text-xs text-[#aaa3b6]"><LockKeyhole size={14}/> Complete the course to unlock your certificate.</p>}</div>}
        </article>;
      })}
    </div>
    <p className="text-[10px] leading-5 text-[#8f899c]">Payments are processed by Flutterwave. M-Pesa is available for KES transactions; card availability depends on your payment provider account being enabled and verified.</p>
  </section>;
}
