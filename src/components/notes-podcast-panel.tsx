"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, FileText, Headphones, LoaderCircle, LockKeyhole, Sparkles, Upload, XCircle } from "lucide-react";

type Question = { question: string; answer: string; type?: string };
type DocumentItem = {
  id: string; title: string; original_filename: string; file_size: number;
  summary: string | null; questions: Question[]; podcast_script: string | null; audio_path: string | null;
  processing_status: "uploaded" | "processing" | "ready" | "failed";
  processing_error: string | null; created_at: string;
};
type Overview = { documents: DocumentItem[]; plan: "basic" | "premium"; limit: number | null; used: number };

export default function NotesPodcastPanel() {
  const [data,setData]=useState<Overview|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [audioUrl,setAudioUrl]=useState<Record<string,string>>({});
  const [expanded,setExpanded]=useState<string|null>(null);
  const input=useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const response=await fetch("/api/documents",{cache:"no-store"});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Sign in to use Notes Podcast.");
      setData(result);
    } catch(e) { setError(e instanceof Error?e.message:"Could not load your notes."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);

  async function upload() {
    if(!file||busy)return;
    setBusy(true);setError("");
    try {
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/documents/upload",{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Upload failed.");
      setFile(null);if(input.current)input.current.value="";
      await load();
      const processResponse=await fetch(`/api/documents/${result.id}/process`,{method:"POST"});
      const processResult=await processResponse.json();
      if(!processResponse.ok)throw new Error(processResult.error||"Your document was uploaded but could not be processed.");
      await load();
      setExpanded(result.id);
    } catch(e) {setError(e instanceof Error?e.message:"Could not upload your document.");await load();}
    finally {setBusy(false);}
  }

  async function listen(id:string) {
    setError("");
    try {
      const response=await fetch(`/api/documents/${id}/audio`);
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Audio is unavailable.");
      setAudioUrl(v=>({...v,[id]:result.url}));
    } catch(e) {setError(e instanceof Error?e.message:"Could not open audio.");}
  }

  async function upgrade() {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/premium/checkout",{method:"POST"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not start Premium checkout.");
      window.location.assign(result.setupUrl);
    } catch(e) {setError(e instanceof Error?e.message:"Could not start checkout.");setBusy(false);}
  }

  async function cancel() {
    if(!window.confirm("Cancel your AJEY Premium recurring card subscription?"))return;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/premium/cancel",{method:"POST"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not cancel subscription.");
      setError(result.message||"Cancellation requested.");
      await load();
    } catch(e) {setError(e instanceof Error?e.message:"Could not cancel membership.");}
    finally {setBusy(false);}
  }

  if(loading)return <section className="panel p-6 text-sm text-[#aaa3b6]"><LoaderCircle className="mr-2 inline animate-spin"/> Loading your Notes Podcast workspace…</section>;

  const premium=data?.plan==="premium";
  const remaining=premium?null:Math.max(0,(data?.limit??11)-(data?.used??0));
  const allowed=".pdf,.docx,.txt,.rtf";

  return <div className="space-y-5">
    <section className="panel overflow-hidden p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 text-[10px] font-extrabold tracking-[.2em] text-[#d6b45f]">AJEY NOTES PODCAST</div><h1 className="text-2xl font-black">Turn your notes into a learning experience.</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-[#aaa3b6]">Upload your class notes or study documents. AJEY creates a clear summary, revision questions with answers, and an audio podcast you can listen to.</p></div>
        <div className="rounded-2xl border border-[#d6b45f]/30 bg-[#d6b45f]/10 px-4 py-3"><div className="text-[10px] font-bold text-[#d6b45f]">YOUR PLAN</div><div className="mt-1 text-lg font-black text-white">{premium?"Premium":"Basic"}</div><div className="text-[10px] text-[#aaa3b6]">{premium?"Unlimited uploads":"11 lifetime uploads"}</div></div>
      </div>
      <p className="mt-4 text-[10px] leading-5 text-[#c5bdcf]">Premium billing disclosure: if you upgrade, IntaSend will charge your saved card KES 50 automatically every month until you cancel.</p>\n      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#1d1926] p-4"><FileText className="mb-2 text-[#e7c76c]" size={19}/><div className="text-xs font-bold">Smart summaries</div><div className="mt-1 text-[10px] text-[#aaa3b6]">Main ideas, explained simply</div></div>
        <div className="rounded-xl bg-[#1d1926] p-4"><Sparkles className="mb-2 text-[#e7c76c]" size={19}/><div className="text-xs font-bold">Revision questions</div><div className="mt-1 text-[10px] text-[#aaa3b6]">Practice questions and answers</div></div>
        <div className="rounded-xl bg-[#1d1926] p-4"><Headphones className="mb-2 text-[#e7c76c]" size={19}/><div className="text-xs font-bold">Audio podcast</div><div className="mt-1 text-[10px] text-[#aaa3b6]">Listen to your study notes</div></div>
      </div>
    </section>

    {error&&<div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-xs text-rose-200">{error}</div>}

    <section className="panel p-5 md:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">Upload a document</h2><p className="mt-1 text-[11px] text-[#aaa3b6]">PDF, DOCX, TXT or RTF · Maximum 20 MB per file</p></div><div className="text-xs font-bold text-[#e7c76c]">{premium?"Unlimited":`${remaining} uploads remaining`}</div></div>
      <div className="rounded-2xl border border-dashed border-[#665b73] bg-[#17141f] p-5 text-center">
        <Upload className="mx-auto mb-3 text-[#d6b45f]" size={25}/>
        <input ref={input} type="file" accept={allowed} onChange={e=>setFile(e.target.files?.[0]??null)} className="mx-auto block max-w-full text-xs text-[#d5cddd] file:mr-3 file:rounded-lg file:border-0 file:bg-[#d6b45f] file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#17141f]"/>
        {file&&<p className="mt-3 text-xs text-[#e7c76c]">{file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
        <button disabled={!file||busy||(!premium&&remaining===0)} onClick={()=>void upload()} className="gold-button mt-4 rounded-xl px-6 py-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-40">{busy?<><LoaderCircle className="mr-2 inline animate-spin" size={14}/>Processing…</>:"Upload and create my study pack"}</button>
      </div>
      {!premium&&remaining===0&&<div className="mt-4 rounded-xl border border-[#d6b45f]/30 bg-[#d6b45f]/10 p-4"><p className="text-xs font-bold text-[#e7c76c]">You have reached the 11-note Basic limit.</p><p className="mt-1 text-[11px] text-[#c9c1d1]">Upgrade for KES 50 per month and upload unlimited notes.</p><button disabled={busy} onClick={()=>void upgrade()} className="gold-button mt-3 rounded-lg px-4 py-2 text-xs font-extrabold">Upgrade to Premium · KES 50/month</button></div>}
      {!premium&&remaining!==0&&<p className="mt-3 text-[10px] text-[#aaa3b6]">Want unlimited uploads? <button disabled={busy} onClick={()=>void upgrade()} className="font-bold text-[#e7c76c] underline">Upgrade to Premium for KES 50/month</button></p>}
      {premium&&<button disabled={busy} onClick={()=>void cancel()} className="mt-3 text-[10px] text-[#aaa3b6] underline">Cancel recurring Premium membership</button>}
    </section>

    <section className="space-y-3">
      <div className="flex items-end justify-between"><div><h2 className="font-extrabold">My uploaded notes</h2><p className="mt-1 text-[11px] text-[#aaa3b6]">{data?.used??0} document(s) saved in your private workspace</p></div></div>
      {!data?.documents.length?<div className="panel p-7 text-center"><LockKeyhole className="mx-auto mb-3 text-[#d6b45f]" size={24}/><p className="text-sm font-bold">Your notes library is waiting.</p><p className="mt-1 text-xs text-[#aaa3b6]">Upload your first document to create a summary, questions and podcast.</p></div>
      :data.documents.map(doc=><article key={doc.id} className="panel p-5">
        <button onClick={()=>setExpanded(expanded===doc.id?null:doc.id)} className="flex w-full items-center gap-3 text-left"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d6b45f]/10 text-[#e7c76c]"><FileAudio size={19}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{doc.title}</div><div className="mt-1 truncate text-[10px] text-[#aaa3b6]">{doc.original_filename} · {new Date(doc.created_at).toLocaleDateString()}</div></div><span className="rounded-full bg-[#282331] px-3 py-1 text-[10px] font-bold text-[#e7c76c]">{doc.processing_status}</span></button>
        {expanded===doc.id&&<div className="mt-5 space-y-5 border-t border-[#393344] pt-5">
          {doc.processing_error&&<p className="text-xs text-rose-300">{doc.processing_error}</p>}
          {doc.summary&&<div><h3 className="mb-2 text-xs font-extrabold text-[#e7c76c]">SUMMARY</h3><p className="whitespace-pre-wrap text-xs leading-6 text-[#d5cddd]">{doc.summary}</p></div>}
          {!!doc.questions?.length&&<div><h3 className="mb-3 text-xs font-extrabold text-[#e7c76c]">REVISION QUESTIONS</h3><div className="space-y-3">{doc.questions.map((q,i)=><details key={i} className="rounded-xl bg-[#1d1926] p-3"><summary className="cursor-pointer text-xs font-bold text-[#eeeaf5]">{i+1}. {q.question}</summary><p className="mt-3 text-xs leading-5 text-[#aaa3b6]">{q.answer}</p></details>)}</div></div>}
          {doc.audio_path?<div><h3 className="mb-2 text-xs font-extrabold text-[#e7c76c]">YOUR AUDIO PODCAST</h3>{audioUrl[doc.id]?<audio controls className="w-full" src={audioUrl[doc.id]}/>:
            <button onClick={()=>void listen(doc.id)} className="gold-button rounded-lg px-4 py-2 text-xs font-bold"><Headphones className="mr-2 inline" size={14}/>Listen to podcast</button>}</div>:doc.podcast_script?<div><h3 className="mb-2 text-xs font-extrabold text-[#e7c76c]">PODCAST SCRIPT</h3><p className="whitespace-pre-wrap text-xs leading-6 text-[#d5cddd]">{doc.podcast_script}</p><p className="mt-2 text-[10px] text-[#aaa3b6]">Audio could not be generated for this note, but your podcast script is saved.</p></div>:doc.processing_status==="ready"&&<p className="text-[11px] text-[#aaa3b6]">Your summary and questions are ready.</p>}
        </div>}
      </article>)}
    </section>
  </div>;
}
