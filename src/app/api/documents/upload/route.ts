import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "text/rtf"
};

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "notes";
}

export async function POST(request: Request) {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload notes." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: "Each document must be smaller than 20 MB." }, { status: 413 });

  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const mimeType = TYPES[extension];
  if (!mimeType) return NextResponse.json({ error: "Supported formats: PDF, DOCX, TXT and RTF." }, { status: 415 });
  if (file.type && file.type !== mimeType && !(extension === ".txt" && file.type === "application/octet-stream")) {
    return NextResponse.json({ error: "The file type does not match its extension." }, { status: 415 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/${randomUUID()}/${safeFilename(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await admin.storage.from("ajey-member-notes").upload(path, bytes, {
    contentType: mimeType,
    upsert: false
  });
  if (storageError) {
    console.error("AJEY document storage upload failed", storageError.message);
    return NextResponse.json({ error: "The document could not be stored. Please try again." }, { status: 502 });
  }

  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Untitled notes";
  const { data: documentId, error } = await admin.rpc("create_member_document", {
    p_user_id: user.id,
    p_title: title,
    p_original_filename: file.name.slice(0, 255),
    p_mime_type: mimeType,
    p_file_size: file.size,
    p_storage_path: path
  });
  if (error || !documentId) {
    await admin.storage.from("ajey-member-notes").remove([path]);
    if (error?.message.includes("BASIC_UPLOAD_LIMIT_REACHED")) {
      return NextResponse.json({ error: "You have used all 11 Basic uploads. Upgrade to AJEY Premium for unlimited notes." }, { status: 402 });
    }
    console.error("AJEY document record creation failed", error?.message);
    return NextResponse.json({ error: "AJEY could not save this document." }, { status: 500 });
  }
  return NextResponse.json({ id: documentId, title, filename: file.name });
}
