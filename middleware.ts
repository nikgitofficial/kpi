import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const email = req.cookies.get("kpi_email");

  const protectedRoutes = ["/eod", "/analytics"];

  if (
    protectedRoutes.some((route) =>
      req.nextUrl.pathname.startsWith(route)
    ) &&
    !email
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/eod/:path*", "/analytics/:path*"],
};