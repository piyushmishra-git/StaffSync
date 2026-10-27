import { Card } from './ui';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtMoney = (n, cur = 'INR') => `${cur} ${Number(n || 0).toLocaleString()}`;

export function Avatar({ url, size = 'h-20 w-20' }) {
  return url ? (
    <img src={url} alt="Profile" className={`${size} rounded-full border border-slate-200 object-cover`} />
  ) : (
    <div className={`${size} flex items-center justify-center rounded-full text-2xl`} style={{ backgroundColor: '#EFF6FF' }}>👤</div>
  );
}

export function InfoGrid({ rows }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm sm:block sm:border-0">
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-medium text-slate-800">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SalaryCard({ salary }) {
  const s = salary || {};
  const net = (s.basic || 0) + (s.hra || 0) + (s.allowances || 0) - (s.deductions || 0);
  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-700">Salary structure</h2>
      <InfoGrid
        rows={[
          ['Basic', fmtMoney(s.basic, s.currency)],
          ['HRA', fmtMoney(s.hra, s.currency)],
          ['Allowances', fmtMoney(s.allowances, s.currency)],
          ['Deductions', `- ${fmtMoney(s.deductions, s.currency)}`],
        ]}
      />
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm">
        <span className="font-semibold text-slate-600">Net monthly pay</span>
        <span className="font-bold text-emerald-700">{fmtMoney(net, s.currency)}</span>
      </div>
    </Card>
  );
}

export function JobCard({ job }) {
  const j = job || {};
  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-700">Job details</h2>
      <InfoGrid
        rows={[
          ['Designation', j.designation],
          ['Department', j.department],
          ['Joining date', fmtDate(j.joiningDate)],
          ['Employment type', j.employmentType],
        ]}
      />
    </Card>
  );
}

export function DocumentsCard({ documents }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-700">Documents</h2>
      {!documents?.length ? (
        <p className="text-sm text-slate-500">No documents uploaded.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {documents.map((d) => (
            <li key={d._id || d.url}>
              <a href={d.url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: '#2563EB' }}>
                📄 {d.name}
              </a>
              <span className="ml-2 text-xs text-slate-400">{fmtDate(d.uploadedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
