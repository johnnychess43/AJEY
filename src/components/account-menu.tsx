"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export default function AccountMenu({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({data})=>setUser(data.user));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));
    return ()=>listener.subscription.unsubscribe();
  },[]);
  if (!user) return <Link href="/sign-in" className="gold-button inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold"><LogIn size={15}/>Sign in</Link>;
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "My account";
  const avatar = user.user_metadata?.avatar_url;
  return <div className="relative">
    <button onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="flex items-center gap-2 rounded-xl border border-[#d6a83d]/25 bg-[#d6a83d]/10 p-1.5 pr-2.5">
      <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#3a2e4d] text-xs font-black text-[#f1d27c]">{avatar?<img src={avatar} alt="" className="h-full w-full object-cover"/>:String(name[0]).toUpperCase()}</span>
      <span className="hidden max-w-28 truncate text-xs font-bold sm:block">{name}</span><ChevronDown size={14}/>
    </button>
    {open&&<div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#3b3347] bg-[#1b1723] p-2 shadow-2xl">
      <div className="border-b border-[#3b3347] px-3 py-2"><div className="truncate text-xs font-bold">{name}</div><div className="truncate text-[10px] text-[#aaa1b4]">{user.email}</div></div>
      <button onClick={()=>{onNavigate("Profile");setOpen(false)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs hover:bg-white/5"><UserRound size={15}/>My profile</button>
      <button onClick={()=>{onNavigate("Settings");setOpen(false)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs hover:bg-white/5"><Settings size={15}/>Settings</button>
      <button onClick={async()=>{await createClient().auth.signOut();setOpen(false);router.refresh();window.location.href="/";}} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs text-rose-300 hover:bg-white/5"><LogOut size={15}/>Sign out</button>
    </div>}
  </div>;
}
