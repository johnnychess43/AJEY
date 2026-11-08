import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/certificate-print-button";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) redirect("/sign-in");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/certificates/" + id);
  const { data: certificate } = await supabase
    .from("certificates")
    .select("id,course_slug,certificate_number,issued_at")
    .eq("id", id)
    .maybeSingle();
  if (!certificate) notFound();
  const courseName = certificate.course_slug.split("-").map((word:string)=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ");
  return <main className="min-h-screen bg-[#100e17] p-5 text-white md:p-10">
    <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-3 print:hidden"><a href="/" className="text-xs font-bold text-[#e7c76c]">← Back to AJEY</a><CertificatePrintButton/></div>
    <article className="mx-auto flex min-h-[680px] max-w-5xl flex-col items-center justify-center border-[10px] border-double border-[#d6b45f] bg-[#191621] px-8 py-16 text-center shadow-2xl print:min-h-screen print:border-black print:bg-white print:text-black">
      <img src="/ajey-logo.jpg" alt="AJEY" className="mb-8 h-20 w-32 object-contain"/>
      <div className="text-xs font-extrabold tracking-[.35em] text-[#d6b45f] print:text-black">CERTIFICATE OF COMPLETION</div>
      <h1 className="mt-8 text-5xl font-black tracking-tight">Congratulations!</h1>
      <p className="mt-7 text-sm text-[#c4bdcf] print:text-gray-700">This certificate is proudly presented to</p>
      <div className="mt-4 border-b border-[#d6b45f] px-10 pb-4 text-3xl font-bold">{user.user_metadata?.full_name ?? user.email}</div>
      <p className="mt-8 max-w-2xl text-sm leading-7 text-[#c4bdcf] print:text-gray-700">For successfully completing the learning path</p>
      <h2 className="mt-3 text-2xl font-extrabold text-[#e7c76c] print:text-black">{courseName}</h2>
      <div className="mt-12 grid gap-6 text-xs text-[#c4bdcf] sm:grid-cols-2 print:text-gray-700"><div><div className="font-bold text-white print:text-black">{new Date(certificate.issued_at).toLocaleDateString("en-KE",{day:"numeric",month:"long",year:"numeric"})}</div><div className="mt-1">Date issued</div></div><div><div className="font-bold text-white print:text-black">{certificate.certificate_number}</div><div className="mt-1">Certificate ID</div></div></div>
      <div className="mt-14 text-[10px] text-[#938ba0] print:text-gray-600">Verify this certificate by contacting AJEY and quoting the certificate ID.</div>
    </article>
  </main>;
}
