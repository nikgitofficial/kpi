import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico";
  if (open) return NextResponse.next();

  const hasSession = req.cookies.get("kpi_team") && req.cookies.get("kpi_name");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|login).*)"],
};