import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'danger-outline' | 'danger' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  size?: 'md' | 'sm';
  children: ReactNode;
}

export default function ZButton({
  variant = 'primary',
  block,
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const classes = [
    'z-btn',
    `z-btn--${variant}`,
    block ? 'z-btn--block' : '',
    size === 'sm' ? 'z-btn--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
