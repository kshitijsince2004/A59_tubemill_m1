import { jsx as _jsx } from "react/jsx-runtime";










export default function ZButton({
  variant = 'primary',
  block,
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  const classes = [
  'z-btn',
  `z-btn--${variant}`,
  block ? 'z-btn--block' : '',
  size === 'sm' ? 'z-btn--sm' : '',
  className].

  filter(Boolean).
  join(' ');

  return (/*#__PURE__*/
    _jsx("button", { type: "button", className: classes, ...rest, children:
      children }
    ));

}