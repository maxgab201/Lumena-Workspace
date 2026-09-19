import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../config/constants';

export const Legal = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-4">
      <main className="max-w-3xl mx-auto space-y-8 text-[var(--text)]">
        <Link to="/" className="text-[var(--accent)] hover:underline">&larr; Back to Home</Link>

        <header className="space-y-2">
          <h1 className="text-4xl font-heading font-semibold">Terms & Privacy — Alpha</h1>
          <p className="text-sm text-muted-foreground">Effective: September 19, 2026</p>
          <p className="text-muted-foreground">
            Lumena Workspace is currently an alpha product. This notice explains how the
            service behaves today. Final public-launch terms still require the product
            owner&apos;s legal entity and jurisdiction details.
          </p>
        </header>

        <section id="terms" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-heading font-semibold">Terms of Service</h2>
          <h3 className="text-lg font-semibold">Using Lumena</h3>
          <p className="text-muted-foreground">
            You may use Lumena to upload, read, annotate, search, and analyze documents
            that you are allowed to use. Do not use the service to violate another
            person&apos;s rights, attack the service, or access another user&apos;s workspace.
          </p>

          <h3 className="text-lg font-semibold">Your documents</h3>
          <p className="text-muted-foreground">
            Uploading a document does not transfer ownership of it to Lumena. You remain
            responsible for the files and information you upload and for having permission
            to process them.
          </p>

          <h3 className="text-lg font-semibold">AI features</h3>
          <p className="text-muted-foreground">
            AI output can be incomplete or incorrect. Highlights, summaries, answers, and
            generated study material should be checked against the source document before
            relying on them.
          </p>

          <h3 className="text-lg font-semibold">Alpha availability</h3>
          <p className="text-muted-foreground">
            Features may change, fail, or be removed while Lumena is in alpha. Core PDF
            reading and annotation are designed to remain separate from optional AI
            services, but uninterrupted availability is not guaranteed.
          </p>

          <h3 className="text-lg font-semibold">Payments</h3>
          <p className="text-muted-foreground">
            Online payments are not enabled in the current alpha. Any future paid plan
            will require separate pricing and payment terms before purchase is available.
          </p>
        </section>

        <section id="privacy" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-heading font-semibold">Privacy Notice</h2>
          <h3 className="text-lg font-semibold">Data Lumena uses</h3>
          <p className="text-muted-foreground">
            The application stores account/profile information, workspace membership,
            uploaded documents, processing results, highlights, notes, chat history,
            settings, and usage records needed to provide the features you use.
          </p>

          <h3 className="text-lg font-semibold">Document processing</h3>
          <p className="text-muted-foreground">
            Documents are stored in the configured Supabase project. Some AI features send
            only the context needed for that request to configured model providers. Core
            PDF viewing and manual annotation do not require an AI request.
          </p>

          <h3 className="text-lg font-semibold">Local browser data</h3>
          <p className="text-muted-foreground">
            Lumena may use browser storage for preferences such as language and interface
            state. Authentication is handled by the configured Supabase Auth service.
          </p>

          <h3 className="text-lg font-semibold">Deletion and retention</h3>
          <p className="text-muted-foreground">
            Deleting a document removes its application record and associated stored file
            through Lumena&apos;s document workflow. Backup, provider, and operational retention
            rules must be finalized before a public production launch.
          </p>

          <h3 className="text-lg font-semibold">Security</h3>
          <p className="text-muted-foreground">
            Workspace access is enforced with authentication, database row-level security,
            and private document-storage policies. No online service can promise absolute
            security.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-6">
          <h2 className="text-xl font-heading font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions about these terms or privacy notice can be sent to{' '}
            <a className="text-[var(--accent)] hover:underline" href={`mailto:${APP_CONFIG.supportEmail}`}>
              {APP_CONFIG.supportEmail}
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
};
