import { createPortal } from "react-dom";
import useSheet from "./useSheet.js";
import "./post.css";

export default function ActionSheet({ title, actions, onClose }) {
  useSheet(onClose);
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head"><h2>{title}</h2></div>
        <div className="actions-list">
          {actions.map((a) => (
            <button key={a.label} type="button" className={"opt" + (a.danger ? " danger" : "")}
              onClick={() => { onClose(); a.onClick(); }}>
              <span className="opt-t">{a.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
      </div>
    </div>,
    document.body
  );
}
