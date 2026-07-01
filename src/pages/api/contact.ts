import type { APIRoute } from 'astro';
import { z } from 'zod';
import { Resend } from 'resend';
import { createRateLimiter } from '../../lib/ratelimit';

export const prerender = false;

const resend = new Resend(
  import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY,
);

const ratelimit = createRateLimiter('ratelimit_contact', 3, '1 h');

const ContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.email('Invalid email address').max(254),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000),
});

const MAX_BODY_BYTES = 16_000;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] || ch);
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (
    !(request.headers.get('content-type') ?? '').includes('application/json')
  ) {
    return jsonResponse({ error: 'Unsupported Media Type' }, 415);
  }

  // Trust only the platform-derived client address; x-forwarded-for is
  // client-spoofable and would let a caller bypass the rate limiter.
  const ip = clientAddress ?? '127.0.0.1';
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return jsonResponse({ error: 'Too many requests' }, 429, {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload too large' }, 413);
    }
    const body = JSON.parse(raw);
    const result = ContactSchema.safeParse(body);

    if (!result.success) {
      return jsonResponse({ error: result.error.issues }, 400);
    }

    const { name, email, message } = result.data;
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    const { data, error } = await resend.emails.send({
      from: 'Portfolio Contact <hello@contact.sheohn.dev>',
      to: 'jared.acebes@gmail.com',
      subject: `New Portfolio Message from ${name.slice(0, 60)}`,
      replyTo: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    if (error) {
      console.error('Resend send error:', error);
      return jsonResponse({ error: 'Failed to send message' }, 500);
    }

    return jsonResponse({ success: true, data }, 200);
  } catch (error) {
    console.error('Contact API Error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
};
