import { useId } from 'react';

export function ZInput({ id, className = '', ...props }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return <input id={inputId} className={`z-input ${className}`.trim()} {...props} />;
}

export function ZSelect({ id, className = '', ...props }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return <select id={selectId} className={`z-select ${className}`.trim()} {...props} />;
}

export function ZTextarea({ id, className = '', ...props }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return <textarea id={areaId} className={`z-textarea ${className}`.trim()} {...props} />;
}
