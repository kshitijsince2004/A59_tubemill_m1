import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function ZInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`z-input ${props.className ?? ''}`.trim()} {...props} />;
}

export function ZSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`z-select ${props.className ?? ''}`.trim()} {...props} />;
}

export function ZTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`z-textarea ${props.className ?? ''}`.trim()} {...props} />;
}
