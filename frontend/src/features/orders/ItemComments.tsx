import { useState } from 'react';

import { ChevronDownIcon, CommentIcon } from '@/components/icons';

// Read-only, collapsible per-unit comments for an order item. Renders nothing
// when no unit has a note. Persona-agnostic — used by any order summary.
export function ItemComments({
  productName,
  comments,
}: {
  productName: string;
  comments?: string[];
}) {
  const [open, setOpen] = useState(false);

  const notes = (comments ?? [])
    .map((text, index) => ({ unit: index + 1, text: text.trim() }))
    .filter((note) => note.text.length > 0);

  if (notes.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase transition-colors hover:text-text"
      >
        <CommentIcon className="h-4 w-4" />
        <span>Item comments ({notes.length})</span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <ul className="mt-2 space-y-1">
          {notes.map((note) => (
            <li key={note.unit} className="text-xs text-text-muted">
              <span className="font-medium text-text">
                {productName} #{note.unit}:
              </span>{' '}
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
