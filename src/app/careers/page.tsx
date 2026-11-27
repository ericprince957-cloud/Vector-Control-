import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Globe2, Handshake, ShieldCheck, Target } from 'lucide-react';
import { CareersApplicationForm } from '@/components/careers-application-form';

export const metadata: Metadata = {
  title: 'Careers — Sales Representative',
  description: 'Join Vector Codes as a remote, commission-based Sales Representative. Help businesses discover better digital solutions.',
  robots: { index: true, follow: true }
};

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-background text-text">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/careers" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[5px] border border-gold/60 text-sm font-bold text-gold">V</span>
            <span><span className="block text-sm font-semibold tracking-wide">VECTOR CODES</span><span className="block text-[9px] uppercase tracking-[0.22em] text-muted">Digital solutions</span></span>
          </Link>
          <Link href="#apply" className="text-xs font-semibold text-gold hover:text-gold-light">Apply now <ArrowRight className="ml-1 inline" size={13} /></Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[32rem] w-[32rem] rounded-full border border-gold/10" />
        <div className="pointer-events-none absolute -right-20 -top-28 h-[24rem] w-[24rem] rounded-full border border-gold/10" />
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Careers at Vector Codes</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Build relationships.<br /><span className="text-gold">Create opportunities.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted">We are looking for people who can identify businesses that need better digital solutions, start meaningful conversations and turn genuine interest into new client opportunities.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="#apply" className="inline-flex min-h-12 items-center gap-2 rounded-[5px] bg-gold px-5 text-sm font-semibold text-black transition hover:bg-gold-light">Apply for the role <ArrowRight size={16} /></Link>
              <span className="text-xs text-muted">Remote · Flexible · Commission-based</span>
            </div>
          </div>
          <div className="rounded-[7px] border border-line-strong bg-surface p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">The opportunity</p>
            <p className="mt-4 text-5xl font-semibold tracking-tight text-gold">10%</p>
            <p className="mt-1 text-sm font-medium">Sales commission</p>
            <p className="mt-3 text-sm leading-6 text-muted">Earn 10% of eligible client payments actually received by Vector Codes from deals attributable to you.</p>
            <div className="my-6 border-t border-line" />
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-gold" size={16} /> No fixed salary or guaranteed earnings</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-gold" size={16} /> Work remotely and manage your schedule</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-gold" size={16} /> Training, product information and sales support</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-3">
        {[
          { icon: Target, title: 'Find opportunities', body: 'Identify SMEs, professionals and organisations that could benefit from a strong digital presence.' },
          { icon: Handshake, title: 'Build trust', body: 'Start professional conversations, understand needs and keep prospects informed.' },
          { icon: ShieldCheck, title: 'Work with clarity', body: 'Use the Vector Control workflow to track leads, follow-ups, deal progress and earned commissions.' }
        ].map((item) => <article key={item.title} className="border-t border-line pt-5"><item.icon className="text-gold" size={20} /><h2 className="mt-4 text-base font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{item.body}</p></article>)}
      </section>

      <section id="apply" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Application form</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Apply to join the team.</h2>
            <p className="mt-4 text-sm leading-7 text-muted">Complete the form with accurate details. Our team will review your application and contact shortlisted candidates by email.</p>
            <div className="mt-8 flex items-start gap-3 text-xs leading-5 text-muted"><Globe2 size={16} className="mt-0.5 shrink-0 text-gold" /> Open to applicants who can communicate professionally with businesses and clients remotely.</div>
          </div>
          <div className="rounded-[7px] border border-line-strong bg-background p-5 sm:p-8">
            {params.submitted ? <div role="status" className="mb-5 flex gap-3 rounded-[5px] border border-emerald-700/50 bg-emerald-950/30 p-4 text-sm text-emerald-200"><CheckCircle2 size={18} className="shrink-0" /> Your application has been submitted. Thank you for your interest in Vector Codes.</div> : null}
            <CareersApplicationForm error={params.error} />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted sm:px-8">
        <span>© {new Date().getFullYear()} Vector Codes. All rights reserved.</span>
        <span>Built with purpose. Powered by Vector Codes.</span>
      </footer>
    </main>
  );
}
