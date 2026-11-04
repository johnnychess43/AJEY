import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url,key,{
    cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll(cookiesToSet){
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      }
    }
  });
  const {data:{user}} = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname !== "/auth" && !request.nextUrl.pathname.startsWith("/_next")) {
    const redirectUrl=request.nextUrl.clone(); redirectUrl.pathname="/auth";
    return NextResponse.redirect(redirectUrl);
  }
  if (user && request.nextUrl.pathname === "/auth") {
    const redirectUrl=request.nextUrl.clone(); redirectUrl.pathname="/";
    return NextResponse.redirect(redirectUrl);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
