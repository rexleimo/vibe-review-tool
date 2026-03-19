interface AiActionPlaceholderProps {
  title: string;
  description: string;
  contextLabel: string;
  onClose: () => void;
}

export function AiActionPlaceholder({
  title,
  description,
  contextLabel,
  onClose,
}: AiActionPlaceholderProps) {
  return (
    <section className="ai-placeholder-backdrop" onClick={onClose}>
      <div
        className="ai-placeholder"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="ai-placeholder-head">
          <div>
            <p className="ai-placeholder-kicker">AI / PRODUCT ACTION</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="ai-placeholder-body">
          <p>{description}</p>
          <div className="ai-placeholder-context">
            <span>当前上下文</span>
            <strong>{contextLabel}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
