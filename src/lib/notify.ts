import { Resend } from 'resend';

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  NOTIFY_FROM?: string;
}

/**
 * Emails mum about a sale. Env-gated: if RESEND_API_KEY or NOTIFY_EMAIL
 * is missing it skips gracefully (order is still in Stripe + worker logs).
 * Default sender is Resend's test address — only delivers to the Resend
 * account owner's inbox until mum verifies her own domain.
 */
export async function notifySale(
  env: NotifyEnv,
  subject: string,
  text: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) {
    return { sent: false, reason: 'email-not-configured' };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.NOTIFY_FROM ?? 'SLP-art <onboarding@resend.dev>',
    to: env.NOTIFY_EMAIL,
    subject,
    text,
  });
  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}
