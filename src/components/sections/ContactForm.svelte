<script lang="ts">
  type Status = 'idle' | 'submitting' | 'success' | 'error';

  interface FieldErrors {
    name?: string;
    email?: string;
    message?: string;
    general?: string;
  }

  let name = $state('');
  let email = $state('');
  let message = $state('');
  let status = $state<Status>('idle');
  let errors = $state<FieldErrors>({});

  const isSubmitting = $derived(status === 'submitting');
  const isDisabled = $derived(
    isSubmitting ||
      name.trim().length < 2 ||
      !email.includes('@') ||
      message.trim().length < 10,
  );

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

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

        if (body?.error && Array.isArray(body.error)) {
          const next: FieldErrors = {};
          for (const issue of body.error) {
            const field = issue.path?.[0];
            if (field === 'name' || field === 'email' || field === 'message') {
              next[field] = issue.message;
            }
          }
          errors =
            Object.keys(next).length > 0
              ? next
              : { general: 'Send failed. Please check the form and retry.' };
        } else {
          errors = { general: 'Send failed. Please try again.' };
        }
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
  <div class="grid gap-2">
    <label
      for="contact-name"
      class="text-xs font-semibold tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase"
    >
      Name
    </label>
    <input
      id="contact-name"
      name="name"
      type="text"
      autocomplete="name"
      required
      minlength="2"
      maxlength="100"
      bind:value={name}
      aria-invalid={errors.name ? 'true' : undefined}
      aria-describedby={errors.name ? 'contact-name-error' : undefined}
      class="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-base text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/30 aria-invalid:border-red-500"
    />
    {#if errors.name}
      <p id="contact-name-error" class="text-sm text-red-500">{errors.name}</p>
    {/if}
  </div>

  <div class="grid gap-2">
    <label
      for="contact-email"
      class="text-xs font-semibold tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase"
    >
      Email
    </label>
    <input
      id="contact-email"
      name="email"
      type="email"
      autocomplete="email"
      required
      maxlength="254"
      bind:value={email}
      aria-invalid={errors.email ? 'true' : undefined}
      aria-describedby={errors.email ? 'contact-email-error' : undefined}
      class="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-base text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/30 aria-invalid:border-red-500"
    />
    {#if errors.email}
      <p id="contact-email-error" class="text-sm text-red-500">
        {errors.email}
      </p>
    {/if}
  </div>

  <div class="grid gap-2">
    <label
      for="contact-message"
      class="text-xs font-semibold tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase"
    >
      Message
    </label>
    <textarea
      id="contact-message"
      name="message"
      required
      minlength="10"
      maxlength="5000"
      rows="6"
      bind:value={message}
      aria-invalid={errors.message ? 'true' : undefined}
      aria-describedby={errors.message ? 'contact-message-error' : undefined}
      class="resize-y rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-base text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/30 aria-invalid:border-red-500"
    ></textarea>
    {#if errors.message}
      <p id="contact-message-error" class="text-sm text-red-500">
        {errors.message}
      </p>
    {/if}
  </div>

  <!-- Status / general error region — announced to screen readers -->
  <div aria-live="polite" aria-atomic="true" class="min-h-[1.5rem] text-sm">
    {#if status === 'success'}
      <p class="text-[var(--color-tertiary)]">
        Message sent. Jared will get back to you soon.
      </p>
    {:else if errors.general}
      <p class="text-red-500">{errors.general}</p>
    {/if}
  </div>

  <button
    type="submit"
    disabled={isDisabled}
    aria-busy={isSubmitting}
    class="inline-flex w-fit items-center gap-2 rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-primary-container),var(--color-primary))] px-6 py-3 text-sm font-semibold tracking-wide text-slate-100 shadow-[0_18px_34px_rgba(28,28,25,0.22)] transition-transform hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
  >
    {#if isSubmitting}
      Sending…
    {:else}
      Send Transmission
    {/if}
  </button>
</form>
