import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailPanel({ isOpen, onClose, title, subtitle, children, actions }: DetailPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-surface border-l border-border h-full flex flex-col shadow-elevated animate-in slide-in-from-right duration-200">
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg transition-colors"
            aria-label="Fechar painel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {children}
        </div>

        {/* Panel Footer */}
        {actions && (
          <div className="p-4 border-t border-border bg-surface-2 flex items-center justify-end gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
