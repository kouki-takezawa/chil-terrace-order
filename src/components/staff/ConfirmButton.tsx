"use client";

export function ConfirmButton({
  confirmText,
  className,
  formAction,
  children,
}: {
  confirmText: string;
  className?: string;
  formAction?: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
