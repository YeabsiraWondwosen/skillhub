import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { formatDate } from './profileHelpers';
import { ShieldCheckIcon, ArrowTopRightOnSquareIcon, IdentificationIcon } from '@heroicons/react/24/outline';

function CredentialLink({ url, children }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
    >
      {children}
      <ArrowTopRightOnSquareIcon className="h-3 w-3" />
    </a>
  );
}

export default function CertificationsSection({ items = [] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Certifications">
        <EmptySection title="No certifications yet" hint="This freelancer hasn't added any certifications yet." />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Certifications">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((cert) => (
          <div key={cert._id} className="flex gap-3 rounded-xl border border-gray-100 bg-white/[0.04] p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <ShieldCheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-200">{cert.name}</h3>
              <p className="text-sm text-gray-500">{cert.issuingOrganization}</p>
              {formatDate(cert.issueDate) && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatDate(cert.issueDate)}
                  {cert.expirationDate ? ` – ${formatDate(cert.expirationDate)}` : ''}
                </p>
              )}
              {(cert.credentialId || cert.credentialUrl) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {cert.credentialId && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <IdentificationIcon className="h-3.5 w-3.5" />
                      {cert.credentialId}
                    </span>
                  )}
                  {cert.credentialUrl && <CredentialLink url={cert.credentialUrl}>Verify</CredentialLink>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
