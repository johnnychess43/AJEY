"use client";

export default function CertificatePrintButton() {
  return <button onClick={()=>window.print()} className="gold-button rounded-xl px-5 py-3 text-xs font-extrabold print:hidden">Download / Print certificate</button>;
}
