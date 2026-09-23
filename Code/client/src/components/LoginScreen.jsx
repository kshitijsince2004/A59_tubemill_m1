import { useEffect, useState } from 'react';

import { ZButton, ZInput } from '../ui';
import { setDevRoleOverride } from '../api/tubemillClient';
import { setDevRoleOverride as setProcessRole } from '../api/http';
import { authApi } from '../api/authApi';
import { setAccessToken, setStoredUser, clearAuth } from '../lib/authStore';
import { initSuperTokensClient, signOutSession, staffSignIn, syncAccessTokenFromSession } from '../lib/supertokens';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

/** Demo seed badges — all use PIN 1234. */
const DEMO_BADGE_PIN = '1234';
const DEMO_BADGES = [
  { badge: 'OP-A59', label: 'TM op' },
  { badge: 'OP-RHF03', label: 'FUR op' },
  { badge: 'OP-STPLINE', label: 'STP op' },
  { badge: 'OP-DB10T', label: 'DRW op' },
  { badge: 'OP-SWG01', label: 'SWG op' },
  { badge: 'MH-TM', label: 'MH TM' },
  { badge: 'MH-FUR', label: 'MH FUR' },
  { badge: 'MH-01', label: 'MH all' },
  { badge: 'PH-01', label: 'Plant' },
  { badge: 'ADM-01', label: 'Admin' },
];

export default function LoginScreen({ onUnlocked }) {
  const [mode, setMode] = useState('badge');
  const [badge, setBadge] = useState('OP-A59');
  const [pin, setPin] = useState(DEMO_BADGE_PIN);
  const [email, setEmail] = useState('admin@a59.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allowHeader, setAllowHeader] = useState(false);

  useEffect(() => {
    initSuperTokensClient();
    let cancelled = false;
    void (async () => {
      // Drop half-dead SuperTokens sessions so probes do not refresh-loop.
      try {
        const { Session } = await import('../lib/supertokens');
        if (await Session.doesSessionExist()) {
          await syncAccessTokenFromSession();
          const me = await authApi.me().catch(() => null);
          if (!me?.user) await signOutSession();
        }
      } catch {
        await signOutSession();
      }
      if (cancelled) return;
      try {
        const r = await fetch('/api/tubemill/session', {
          headers: { 'st-auth-mode': 'header' },
        });
        const j = await r.json();
        if (!cancelled) setAllowHeader(Boolean(j?.data?.allowHeaderRole));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function afterLogin(user, { keepDevRole = false } = {}) {
    setStoredUser(user);
    localStorage.setItem('a59-unlocked', '1');
    localStorage.setItem('a59-role', user.primaryRole);
    localStorage.setItem('a59-badge', user.empCode ?? user.username);
    if (!keepDevRole) {
      setDevRoleOverride(null);
      setProcessRole(null);
    }
    onUnlocked(user);
  }

  function pickDemoBadge(nextBadge) {
    setBadge(nextBadge);
    setPin(DEMO_BADGE_PIN);
    setMode('badge');
    setError(null);
  }

  async function unlockBadge() {
    setError(null);
    setBusy(true);
    try {
      if (!badge.trim() || pin.length !== 4) {
        throw new Error('Enter badge and 4-digit PIN');
      }
      const data = await authApi.badgePin(badge.trim(), pin);
      // Prefer st-access-token captured from response headers (custom session create).
      // Do not wipe it via ST client sync when web-js has no session yet.
      await syncAccessTokenFromSession();
      try {
        const me = await authApi.me();
        await afterLogin(me.user ?? data.user);
      } catch {
        await afterLogin(data.user);
      }
    } catch (err) {
      if (allowHeader) {
        const role = 'OPERATOR';
        setDevRoleOverride(role);
        setProcessRole(role);
        const fake = {
          userId: 'dev',
          username: badge,
          fullName: badge,
          empCode: badge,
          email: null,
          roles: [role],
          primaryRole: role,
          processAccess: [
            { processCode: 'TM', level: 'WRITE' },
            { processCode: 'FUR', level: 'WRITE' },
            { processCode: 'STP', level: 'WRITE' },
            { processCode: 'DRW', level: 'WRITE' },
            { processCode: 'SWG', level: 'WRITE' },
          ],
          machineAccess: [],
        };
        await afterLogin(fake, { keepDevRole: true });
        setError(err instanceof Error ? `${err.message} — using dev header role` : 'Dev fallback');
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function unlockStaff() {
    setError(null);
    setBusy(true);
    try {
      await staffSignIn(email.trim(), password);
      const me = await authApi.me();
      await afterLogin(me.user);
    } catch (err) {
      setError(
        err instanceof Error ?
        `${err.message}. Tip: use Badge/PIN once to provision SuperTokens, or create via Admin.` :
        'Staff sign-in failed'
      );
    } finally {
      setBusy(false);
    }
  }

  return (/*#__PURE__*/
    _jsxs("div", { className: "login-screen", children: [/*#__PURE__*/
      _jsxs("header", { className: "login-screen__bar", children: [/*#__PURE__*/
        _jsxs("span", { className: "login-screen__brand-group", children: [/*#__PURE__*/
          _jsx("img", {
            className: "login-screen__plant-logo",
            src: "/logo-goodluck.png",
            width: 36,
            height: 36,
            alt: "Goodluck",
          }), /*#__PURE__*/
          _jsx("span", { className: "login-screen__brand", children: "Zedral" })] }
        ), /*#__PURE__*/
        _jsx("span", { children: "Operator Console \xB7 A-59" }), /*#__PURE__*/
        _jsx("span", { className: "mono", children: new Date().toLocaleTimeString() })] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "login-screen__card", children: [/*#__PURE__*/
        _jsx("h1", { children: "Sign in" }), /*#__PURE__*/
        _jsx("p", { className: "muted", children: "Badge ID + 4-digit PIN for operators, machine heads, and admin" }), /*#__PURE__*/
        _jsxs("div", { className: "login-screen__modes", children: [/*#__PURE__*/
          _jsx("button", {
            type: "button",
            className: mode === 'badge' ? 'process-nav__item active' : 'process-nav__item',
            onClick: () => setMode('badge'), children:
            "Badge / PIN" }

          ), /*#__PURE__*/
          _jsx("button", {
            type: "button",
            className: mode === 'staff' ? 'process-nav__item active' : 'process-nav__item',
            onClick: () => setMode('staff'), children:
            "Staff email" }

          )] }
        ),
        error && /*#__PURE__*/_jsx("div", { className: "error-strip", children: error }),
        mode === 'badge' ? /*#__PURE__*/
        _jsxs(_Fragment, { children: [/*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Badge ID" }), /*#__PURE__*/
          _jsx(ZInput, {
            value: badge,
            onChange: (e) => setBadge(e.target.value),
            placeholder: "e.g. OP-A59 / MH-FUR / ADM-01",
            autoComplete: "username",
          }), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "PIN" }), /*#__PURE__*/
          _jsx(ZInput, {
            type: "password",
            value: pin,
            onChange: (e) => setPin(e.target.value),
            maxLength: 4,
            inputMode: "numeric",
            placeholder: "1234",
            autoComplete: "current-password",
          }), /*#__PURE__*/
          _jsxs("div", { className: "login-screen__demos", children: [/*#__PURE__*/
            _jsx("span", { className: "eyebrow", children: "Demo (PIN 1234)" }), /*#__PURE__*/
            _jsx("div", { className: "login-screen__demo-chips", children:
              DEMO_BADGES.map((d) => /*#__PURE__*/
              _jsx("button", {
                type: "button",
                className: badge === d.badge ? 'login-screen__demo-chip active' : 'login-screen__demo-chip',
                onClick: () => pickDemoBadge(d.badge),
                title: `${d.badge} / ${DEMO_BADGE_PIN}`,
                children: d.label
              }, d.badge)
              )
            })] }
          ), /*#__PURE__*/
          _jsx(ZButton, {
            variant: "primary",
            disabled: busy,
            onClick: () => void unlockBadge(),
            style: { width: '100%', marginTop: 16 }, children:
            "Sign in" }

          )] }
        ) : /*#__PURE__*/

        _jsxs(_Fragment, { children: [/*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Email" }), /*#__PURE__*/
          _jsx(ZInput, { value: email, onChange: (e) => setEmail(e.target.value) }), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Password" }), /*#__PURE__*/
          _jsx(ZInput, { type: "password", value: password, onChange: (e) => setPassword(e.target.value) }), /*#__PURE__*/
          _jsx("p", { className: "muted", style: { marginTop: 8, fontSize: 12 }, children: "Prefer Badge / PIN (same accounts). Email works after first badge login." }), /*#__PURE__*/
          _jsx(ZButton, {
            variant: "primary",
            disabled: busy,
            onClick: () => void unlockStaff(),
            style: { width: '100%', marginTop: 16 }, children:
            "Sign in" }

          )] }
        ), /*#__PURE__*/

        _jsx("button", {
          type: "button",
          className: "linkish",
          style: { marginTop: 12 },
          onClick: () => {
            clearAuth();
            setAccessToken(null);
          }, children:
          "Clear local session" }

        )] }
      )] }
    ));

}
