import { createPortal } from "react-dom";
import PostCard from "./PostCard.jsx";
import useSheet from "./useSheet.js";

export default function PreviewSheet({ post, onClose }) {
  useSheet(onClose);
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Pratinjau"
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Pratinjau di feed</h2>
          <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
        </div>
        <div className="prev-wrap"><PostCard post={post} preview /></div>
      </div>
    </div>,
    document.body
  );
}
