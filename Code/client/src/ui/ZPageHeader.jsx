import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";







export default function ZPageHeader({ title, subtitle, actions }) {
  return (/*#__PURE__*/
    _jsxs("div", { className: "page-header z-page-header", children: [/*#__PURE__*/
      _jsxs("div", { className: "page-header__left", children: [/*#__PURE__*/
        _jsx("div", { className: "page-header__accent" }), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("h1", { className: "page-header__title", children: title }),
          subtitle ? /*#__PURE__*/_jsx("p", { className: "page-header__sub", children: subtitle }) : null] }
        )] }
      ),
      actions ? /*#__PURE__*/_jsx("div", { className: "page-header__actions", children: actions }) : null] }
    ));

}