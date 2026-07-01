<script lang="ts">
  import { tick } from 'svelte';
  import ContactField from './ContactField.svelte';

  type Status = 'idle' | 'submitting' | 'success' | 'error';

  interface FieldErrors {
    name?: string;
    email?: string;
    message?: string;
    general?: string;
  }

  // Maps the API's Zod issue array (400) onto our field-keyed error shape.
  // Falls back to a general message when the response isn't the expected shape
  // or names no known field.
  function mapServerErrors(
    body: {
      error?: Array<{ path?: string[]; message: string }>;
    } | null,
  ): FieldErrors {
    if (!body?.error || !Array.isArray(body.error)) {
      return { general: 'Send failed. Please try again.' };
    }
    const next: FieldErrors = {};
    for (const issue of body.error) {
      const field = issue.path?.[0];
      if (field === 'name' || field === 'email' || field === 'message') {
        next[field] = issue.message;
      }
    }
    return Object.keys(next).length > 0
      ? next
      : { general: 'Send failed. Please check the form and retry.' };
  }

  let name = $state('');
  let email = $state('');
  let message = $state('');
  let status = $state<Status>('idle');
  let errors = $state<FieldErrors>({});

  const isSubmitting = $derived(status === 'submitting');

  // Validate the same constraints the server enforces, with specific copy.
  // Returns the field errors; empty object means the form is ready to send.
  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (name.trim().length < 2) {
      next.name = 'Please enter your name (at least 2 characters).';
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (message.trim().length < 10) {
      next.message = 'Add a little more — at least 10 characters.';
    }
    return next;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    // Validate on submit rather than disabling the button: the control stays
    // operable for keyboard/SR users, and a failed attempt surfaces specific,
    // focusable errors instead of a silent dead button.
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      errors = clientErrors;
      status = 'idle';
      await tick();
      const firstInvalid = (['name', 'email', 'message'] as const).find(
        (f) => clientErrors[f],
      );
      if (firstInvalid) {
        document.getElementById(`contact-${firstInvalid}`)?.focus();
      }
      return;
    }

    errors = {};
    status = 'submitting';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (res.status === 429) {
        errors = {
          general: 'Too many requests. Try again in about an hour.',
        };
        status = 'error';
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: Array<{ path?: string[]; message: string }>;
        } | null;
        errors = mapServerErrors(body);
        status = 'error';
        return;
      }

      status = 'success';
      name = '';
      email = '';
      message = '';
    } catch {
      errors = { general: 'Network error. Please try again.' };
      status = 'error';
    }
  }
</script>

<form
  onsubmit={handleSubmit}
  novalidate
  aria-label="Contact form"
  class="grid gap-6"
>
  <ContactField
    id="contact-name"
    name="name"
    label="Name"
    autocomplete="name"
    minlength={2}
    maxlength={100}
    bind:value={name}
    error={errors.name}
  />

  <ContactField
    id="contact-email"
    name="email"
    label="Email"
    type="email"
    autocomplete="email"
    maxlength={254}
    bind:value={email}
    error={errors.email}
  />

  <ContactField
    id="contact-message"
    name="message"
    label="Message"
    minlength={10}
    maxlength={5000}
    rows={6}
    bind:value={message}
    error={errors.message}
  />

  <!-- Status / general error region — announced to screen readers -->
  <div aria-live="polite" aria-atomic="true" class="min-h-[1.5rem] text-sm">
    {#if status === 'success'}
      <p class="text-[var(--color-tertiary)]">
        Message sent. Jared will get back to you soon.
      </p>
    {:else if errors.general}
      <p class="text-[var(--color-error)]">{errors.general}</p>
    {/if}
  </div>

  <button
    type="submit"
    disabled={isSubmitting}
    aria-busy={isSubmitting}
    class="inline-flex w-fit items-center gap-2 rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-cta-from),var(--color-cta-to))] px-6 py-3 text-sm font-semibold tracking-wide text-[var(--color-on-cta)] shadow-[0_18px_34px_rgba(28,28,25,0.22)] transition-transform hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
  >
    {#if isSubmitting}
      Sending…
    {:else}
      Send Transmission
    {/if}
  </button>
</form>
