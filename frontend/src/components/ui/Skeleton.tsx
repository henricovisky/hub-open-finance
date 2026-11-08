import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-surface-2 rounded-md', className)} />;
}
