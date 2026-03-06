import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-14 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-cyan-400/15" />
      <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
      <p className="mx-auto max-w-xl text-sm leading-6 text-white/55">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
