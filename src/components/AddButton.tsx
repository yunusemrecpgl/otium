interface AddButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AddButton({ onClick, disabled }: AddButtonProps) {
  return (
    <button type="button" className="workspace-control workspace-slot add-button" aria-label="Add link" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
