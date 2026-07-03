import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/admin/login'];

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (decoded.exp) {
      return decoded.exp * 1000 < Date.now();
    }
    return false;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('pos_admin_token')?.value;
    if (!token || isTokenExpired(token)) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      if (token && isTokenExpired(token)) response.cookies.delete('pos_admin_token');
      return response;
    }
  }

  const ROOT_DASHBOARD_ROUTES = ['/sales', '/inventory', '/customers', '/returns', '/reports', '/shifts', '/treasury'];

  if (pathname.startsWith('/dashboard') || pathname === '/' || ROOT_DASHBOARD_ROUTES.includes(pathname)) {
    const token = request.cookies.get('pos_token')?.value;
    if (!token || isTokenExpired(token)) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      if (token && isTokenExpired(token)) {
        response.cookies.delete('pos_token');
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
