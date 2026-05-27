import type { APIRoute } from 'astro';
import { z } from 'zod';
import { Resend } from 'resend';

export const prerender = false;

const resend = new Resend(
  import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY,
);

const ContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email({ message: 'Invalid email address' }),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = ContactSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { name, email, message } = result.data;

    // Send the email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Portfolio Contact <onboarding@resend.dev>', // Replace with your verified Resend domain in production
      to: 'jared.acebes@gmail.com',
      subject: `New Portfolio Message from ${name}`,
      replyTo: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br/>')}</p>
      `,
    });

    if (error) {
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Contact API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
