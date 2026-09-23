import React from "react";
import { createPortal } from "react-dom";

// Меню, вынесенное порталом в document.body — не обрезается overflow:auto
// у родителей (например, горизонтально скроллящейся таблицы транзакций)
// и не влияет на их layout/высоту строки.
function DropdownMenu({ anchorRef, isOpen, onClose, align = "end", className, children }) {
  const [pos, setPos] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: align === "end" ? rect.right : rect.left,
      });
    };

    updatePosition();
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [isOpen, anchorRef, align, onClose]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      className={className}
      // Портал рендерится в document.body, но клики всё равно всплывают
      // по React-дереву (через .dots), а не по DOM — без остановки клик
      // по пункту меню повторно триггерит toggleMenu на родителе.
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: align === "end" ? "translateX(-100%)" : "none",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default DropdownMenu;
