import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type SelectValue = string | number;

type Option<TValue extends SelectValue> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  status?: 'unknown' | 'checking' | 'online' | 'warning' | 'offline';
};

type NodeCustomSelectProps<TValue extends SelectValue> = {
  id?: string;
  value?: TValue;
  disabled?: boolean;
  onChange: (val: TValue) => void;
  options: ReadonlyArray<Option<TValue>>;
};

export function NodeCustomSelect<TValue extends SelectValue>({
  id,
  value,
  disabled = false,
  onChange,
  options,
}: NodeCustomSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  if (disabled && isOpen) {
    setIsOpen(false);
  }

  const isPopoverOpen = isOpen && !disabled;

  const updatePopoverStyle = useCallback(() => {
    const button = containerRef.current?.querySelector('.node-custom-select-button');
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const top = rect.bottom + 4;
    setPopoverStyle({
      position: 'fixed',
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(96, window.innerHeight - top - 12),
    });
  }, []);

  useEffect(() => {
    if (!isPopoverOpen) return;
    updatePopoverStyle();
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleReposition = () => updatePopoverStyle();
    document.addEventListener('pointerdown', handleOutsideClick);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isPopoverOpen, updatePopoverStyle]);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];
  const glassDesignElement =
    typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('.studio.glass-design-active')
      : null;
  const isGlassDesignActive = glassDesignElement !== null;
  const glassPopoverStyle = isGlassDesignActive
    ? ({
        ...popoverStyle,
        '--glass-opacity':
          getComputedStyle(glassDesignElement).getPropertyValue('--glass-opacity') || undefined,
      } as CSSProperties)
    : popoverStyle;
  const popover = isPopoverOpen && popoverStyle ? (
    <div
      className={`node-custom-select-popover${isGlassDesignActive ? ' glass-design-popover' : ''}`}
      ref={popoverRef}
      role="menu"
      style={glassPopoverStyle ?? undefined}
    >
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          role="menuitem"
          className={`node-custom-select-option ${opt.value === value ? 'selected' : ''}`}
          disabled={opt.disabled}
          onClick={() => {
            if (opt.disabled) {
              return;
            }
            onChange(opt.value);
            setIsOpen(false);
          }}
        >
          <span className="node-custom-select-option-label">{opt.label}</span>
          {opt.status ? (
            <span
              className={`node-custom-select-status ${opt.status}`}
              aria-label={opt.status}
            />
          ) : null}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="node-custom-select-container nodrag nowheel" ref={containerRef}>
      <button
        id={id}
        type="button"
        className="node-custom-select-button"
        aria-expanded={isPopoverOpen}
        disabled={disabled}
        onClick={() => {
          updatePopoverStyle();
          setIsOpen((prev) => !prev);
        }}
      >
        <span className="node-custom-select-option-label">{selectedOption?.label ?? ''}</span>
        {selectedOption?.status ? (
          <span
            className={`node-custom-select-status ${selectedOption.status}`}
            aria-label={selectedOption.status}
          />
        ) : null}
        <span className="node-custom-select-arrow">▾</span>
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
