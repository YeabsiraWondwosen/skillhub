export default function SectionCard({ title, action, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
