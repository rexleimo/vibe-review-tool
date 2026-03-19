import { type AiProvider } from "../hooks/useAiProvider";
import "./ProviderSettingsSheet.css";

type ProviderStatus = {
  provider: AiProvider;
  label: string;
  command: string;
  available: boolean;
};

interface ProviderSettingsSheetProps {
  provider: AiProvider;
  statuses: ProviderStatus[];
  loading: boolean;
  onClose: () => void;
  onSelect: (provider: AiProvider) => void;
}

export function ProviderSettingsSheet({
  provider,
  statuses,
  loading,
  onClose,
  onSelect,
}: ProviderSettingsSheetProps) {
  return (
    <section className="provider-settings-backdrop" onClick={onClose}>
      <div
        className="provider-settings"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="provider-settings-head">
          <div>
            <p className="provider-settings-kicker">AI / SETTINGS</p>
            <h2>Default AI Provider</h2>
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="provider-settings-body">
          <p className="provider-settings-copy">
            选择 Review Summary 默认使用的本机 CLI provider。当前只把 Summary 接成真实动作，其他 AI
            能力会继续沿用占位入口。
          </p>

          <div className="provider-settings-list">
            {loading ? (
              <p className="hint">正在检测本机 CLI 可用性...</p>
            ) : (
              statuses.map((item) => {
                const selected = item.provider === provider;
                return (
                  <button
                    key={item.provider}
                    type="button"
                    className={selected ? "provider-card selected" : "provider-card"}
                    onClick={() => onSelect(item.provider)}
                  >
                    <div className="provider-card-main">
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.command}</span>
                      </div>
                      <span className={item.available ? "provider-badge available" : "provider-badge"}>
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    <p>
                      {selected ? "当前默认 provider" : "设为默认 provider"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
