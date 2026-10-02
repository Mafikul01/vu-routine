interface VercelRequest {
  method?: string;
  body?: any;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: any) => void;
  send: (body: any) => void;
  setHeader: (name: string, value: string) => void;
}

let activeUniversityCookieHeader: string = '';
let isLoggingIn = false;
let loginPromise: Promise<string | null> | null = null;

async function loginUniversitySession(overrideRoll?: string, overridePass?: string): Promise<string | null> {
  const roll = overrideRoll || process.env.UNIVERSITY_ROLL || process.env.UNIVERSITY_STUDENT_ROLL || '';
  const password = overridePass || process.env.UNIVERSITY_PASSWORD || process.env.UNIVERSITY_STUDENT_PASSWORD || '';

  if (!roll || !password) {
    return activeUniversityCookieHeader || null;
  }

  if (isLoggingIn && loginPromise) {
    return loginPromise;
  }

  isLoggingIn = true;
  loginPromise = (async () => {
    try {
      console.log('[Vercel University Auth] Fetching student login page to extract CSRF token...');
      const loginPageResp = await fetch('http://160.187.25.3:8083/front/student/login', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const rawSetCookie = loginPageResp.headers.get('set-cookie') || '';
      const cookieParts = rawSetCookie.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean);
      const initialCookieHeader = cookieParts.join('; ');
      const html = await loginPageResp.text();

      const tokenMatch =
        html.match(/name="_token"\s+type="hidden"\s+value="([^"]+)"/i) ||
        html.match(/value="([^"]+)"\s+name="_token"/i) ||
        html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/i);

      if (!tokenMatch) {
        console.error('[Vercel University Auth] Failed to extract CSRF _token from login page.');
        return null;
      }

      const csrfToken = tokenMatch[1];
      const params = new URLSearchParams();
      params.append('_token', csrfToken);
      params.append('roll', roll.trim());
      params.append('password', password.trim());
      params.append('pass', password.trim());

      const postResp = await fetch('http://160.187.25.3:8083/front/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Cookie': initialCookieHeader,
          'Referer': 'http://160.187.25.3:8083/front/student/login',
          'Origin': 'http://160.187.25.3:8083',
        },
        body: params.toString(),
        redirect: 'manual',
      });

      const postCookiesRaw = postResp.headers.get('set-cookie') || '';
      const postCookieParts = postCookiesRaw.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean);

      if (postCookieParts.length > 0) {
        const mergedCookies = new Map<string, string>();
        [...cookieParts, ...postCookieParts].forEach((c) => {
          const [k, v] = c.split('=');
          if (k && v) mergedCookies.set(k.trim(), v.trim());
        });

        activeUniversityCookieHeader = Array.from(mergedCookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');

        console.log('[Vercel University Auth] Successfully logged in and captured session cookies.');
        return activeUniversityCookieHeader;
      }

      return activeUniversityCookieHeader || null;
    } catch (err) {
      console.error('[Vercel University Auth] Error during login flow:', err);
      return null;
    } finally {
      isLoggingIn = false;
      loginPromise = null;
    }
  })();

  return loginPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow session updates via POST
  if (req.method === 'POST') {
    const { session } = req.body || {};
    if (typeof session === 'string' && session.trim()) {
      activeUniversityCookieHeader = session.trim().includes('=') ? session.trim() : `easymate_session=${session.trim()}`;
      return res.status(200).json({ success: true, message: 'Session updated' });
    }
    return res.status(400).json({ error: 'Invalid session string' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const semesterId = String(req.query.semester_id || '7').trim();
    const sectionId = String(req.query.section_id || '1').trim();

    const fetchRoutineHtml = async (cookies: string) => {
      const targetUrl = `http://160.187.25.3:8083/front/student/routine/load?semester_id=${encodeURIComponent(semesterId)}&section_id=${encodeURIComponent(sectionId)}`;
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://160.187.25.3:8083/front/student/routine',
      };
      if (cookies) {
        headers['Cookie'] = cookies.includes('=') ? cookies : `easymate_session=${cookies}`;
      }
      const resp = await fetch(targetUrl, { headers, redirect: 'manual' });
      return resp;
    };

    let cookies = (req.headers['x-university-cookie'] as string) || activeUniversityCookieHeader;
    if (!cookies) {
      cookies = (await loginUniversitySession()) || '';
    }

    let response = await fetchRoutineHtml(cookies);
    let isAuthRequired = response.status === 302 || response.status === 301;
    let html = '';

    if (!isAuthRequired) {
      html = await response.text();
      if (
        html.includes('/front/student/login') ||
        html.includes('<title>Redirecting to http://160.187.25.3:8083/front/student/login</title>')
      ) {
        isAuthRequired = true;
      }
    }

    // Auto-relogin retry if session expired
    const hasCredentials = !!(process.env.UNIVERSITY_ROLL || process.env.UNIVERSITY_STUDENT_ROLL);
    if (isAuthRequired && hasCredentials) {
      console.log('[Vercel University Routine Proxy] Session expired. Performing automatic re-login retry...');
      const freshCookies = await loginUniversitySession();
      if (freshCookies) {
        cookies = freshCookies;
        response = await fetchRoutineHtml(cookies);
        if (response.status !== 302 && response.status !== 301) {
          html = await response.text();
          if (!html.includes('/front/student/login')) {
            isAuthRequired = false;
          }
        }
      }
    }

    if (isAuthRequired) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'University session expired or login required',
      });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: unknown) {
    console.error('Vercel University Routine Proxy Error:', error);
    return res.status(502).json({
      error: 'PROXY_ERROR',
      message: 'Failed to connect to University endpoint',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
