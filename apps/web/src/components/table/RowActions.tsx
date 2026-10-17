import { Icon } from "@/components/Icon";

type RowActionsProps = {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function RowActions({ editLabel, deleteLabel, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        aria-label={editLabel}
        className="icon-button h-8 w-8"
        onClick={onEdit}
        title={editLabel}
        type="button"
      >
        <Icon className="h-4 w-4" name="pencil" />
      </button>
      <button
        aria-label={deleteLabel}
        className="icon-button h-8 w-8 hover:bg-rose-700/10 hover:text-rose-700"
        onClick={onDelete}
        title={deleteLabel}
        type="button"
      >
        <Icon className="h-4 w-4" name="trash" />
      </button>
    </div>
  );
}
