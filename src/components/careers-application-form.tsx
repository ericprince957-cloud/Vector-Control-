import { submitApplication } from '@/actions/applications';
import { SubmitButton } from '@/components/submit-button';

const field = 'mt-1.5 min-h-11 w-full rounded-[5px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60 focus:border-gold/70 focus:outline-none';
const label = 'block text-xs font-medium text-muted';

export function CareersApplicationForm({ error }: { error?: string }) {
  return (
    <form id="apply" action={submitApplication} className="space-y-5">
      {error ? <p role="alert" className="rounded-[5px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Full name *<input className={field} name="full_name" autoComplete="name" required minLength={2} maxLength={160} placeholder="Your full name" /></label>
        <label className={label}>Email address *<input className={field} name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
        <label className={label}>Phone number *<input className={field} name="phone" type="tel" autoComplete="tel" required placeholder="+234..." /></label>
        <label className={label}>WhatsApp number<input className={field} name="whatsapp" type="tel" placeholder="If different from your phone" /></label>
        <label className={label}>Current location<input className={field} name="location" placeholder="City, State, Country" /></label>
        <label className={label}>Sales experience *
          <select className={field} name="experience_level" defaultValue="no_experience" required>
            <option value="no_experience">No formal experience</option>
            <option value="entry_level">Entry level</option>
            <option value="intermediate">Intermediate</option>
            <option value="experienced">Experienced</option>
          </select>
        </label>
        <label className={label}>Years of experience<input className={field} name="years_experience" type="number" min="0" max="60" step="0.5" placeholder="e.g. 1" /></label>
        <label className={label}>Availability *
          <select className={field} name="availability" defaultValue="immediately" required>
            <option value="immediately">Immediately</option>
            <option value="one_week">Within one week</option>
            <option value="two_weeks">Within two weeks</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
      </div>
      <label className={label}>Sales and communication skills<input className={field} name="skills" placeholder="e.g. prospecting, negotiation, WhatsApp sales, follow-up" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Portfolio or website<input className={field} name="portfolio_url" type="url" placeholder="https://" /></label>
        <label className={label}>LinkedIn profile<input className={field} name="linkedin_url" type="url" placeholder="https://linkedin.com/in/..." /></label>
        <label className={label}>GitHub profile (optional)<input className={field} name="github_url" type="url" placeholder="https://github.com/..." /></label>
        <label className={label}>CV link (Google Drive or other)<input className={field} name="cv_url" type="url" placeholder="Paste a shareable CV link" /></label>
      </div>
      <label className={label}>Why would you like to join Vector Codes? *
        <textarea className={field + ' min-h-32 resize-y'} name="cover_letter" required minLength={40} maxLength={3000} placeholder="Tell us about your approach to finding clients, communicating with businesses and following up professionally." />
      </label>
      <div className="hidden" aria-hidden="true">
        <label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="rounded-[5px] border border-line bg-surface-2 p-4 text-xs leading-6 text-muted">
        <p className="font-semibold text-text">Before you apply</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>This is a remote, flexible, commission-based Sales Representative role.</li>
          <li>Commission is 10% of eligible client payments actually received by Vector Codes.</li>
          <li>There is no salary guarantee. Commissions are not calculated on unpaid deal values.</li>
          <li>Pricing, discounts, contracts and strategic deals remain under founder approval.</li>
        </ul>
      </div>
      <SubmitButton className="w-full sm:w-auto" pendingLabel="Submitting application…">Submit application</SubmitButton>
      <p className="text-[11px] text-muted">By submitting, you confirm that the information provided is accurate and may be used to assess your application.</p>
    </form>
  );
}
