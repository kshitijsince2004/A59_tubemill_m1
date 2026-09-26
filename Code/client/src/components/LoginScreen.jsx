import { useEffect, useState } from 'react';

import { ZButton, ZInput } from '../ui';
import { setDevRoleOverride } from '../api/http';
import { authApi } from '../api/authApi';
import { setAccessToken, setStoredUser, clearAuth, getAccessToken, primaryRole } from '../lib/authStore';
import { initSuperTokensClient, signOutSession, staffSignIn, syncAccessTokenFromSession } from '../lib/supertokens';
import { isOperatorBuild } from '../lib/buildFlags';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

/** Demo seed badges — local/dev only; never on operator APK or production without explicit flag. */
const SHOW_DEMO_CHIPS =
  !isOperatorBuild() &&
  (import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true');
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

const OPERATOR_ONLY_MSG = 'This account is not permitted to use this application.';

function assertOperatorAllowed(user) {
  if (!isOperatorBuild()) return;
  const role = primaryRole(user);
  const elevated = (user?.roles ?? []).some(
    (r) => r === 'MACHINE_HEAD' || r === 'PLANT_HEAD' || r === 'ADMIN'
  );
  if (role !== 'OPERATOR' || elevated) {
    throw new Error(OPERATOR_ONLY_MSG);
  }
}

export default function LoginScreen({ onUnlocked }) {
  const [mode, setMode] = useState('badge');
  const [badge, setBadge] = useState(SHOW_DEMO_CHIPS ? 'OP-A59' : '');
  const [pin, setPin] = useState(SHOW_DEMO_CHIPS ? DEMO_BADGE_PIN : '');
  const [email, setEmail] = useState(SHOW_DEMO_CHIPS ? 'admin@a59.local' : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allowHeader, setAllowHeader] = useState(false);
  /** null = probing; true = ST Core; false = HMAC demo sessions */
  const [superTokensOn, setSuperTokensOn] = useState(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let stEnabled = false;
      try {
        const r = await fetch(`${(import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')}/tubemill/session`, {
          headers: { 'st-auth-mode': 'header' },
        });
        const j = await r.json();
        if (cancelled) return;
        setAllowHeader(Boolean(j?.data?.allowHeaderRole));
        stEnabled = j?.data?.superTokens === true;
        setSuperTokensOn(stEnabled);
      } catch {
        if (!cancelled) setSuperTokensOn(false);
      }
      if (cancelled) return;

      // Only touch SuperTokens web-js when the API actually has ST Core.
      // Demo HMAC sessions must not trigger ST refresh against a dead Core.
      if (!stEnabled) return;

      initSuperTokensClient();
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function afterLogin(user, { keepDevRole = false } = {}) {
    assertOperatorAllowed(user);
    setStoredUser(user);
    localStorage.setItem('a59-unlocked', '1');
    localStorage.setItem('a59-role', user.primaryRole);
    localStorage.setItem('a59-badge', user.empCode ?? user.username);
    if (!keepDevRole) setDevRoleOverride(null);
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
      if (!getAccessToken()) {
        throw new Error(
          'Login succeeded but no session token received — check API headers (st-access-token) / SuperTokens'
        );
      }
      try {
        const me = await authApi.me();
        await afterLogin(me.user ?? data.user);
      } catch (inner) {
        if (inner instanceof Error && inner.message === OPERATOR_ONLY_MSG) throw inner;
        await afterLogin(data.user);
      }
      // Cache offline PIN verifier after successful online login
      try {
        const { buildPinVerifier } = await import('../offline/offlinePin');
        const { saveAuthCache } = await import('../offline/db');
        let deviceId = sessionStorage.getItem('a59-device-id') || 'web';
        const verifier = await buildPinVerifier(pin, badge.trim(), deviceId);
        await saveAuthCache({
          userCode: badge.trim(),
          pinVerifier: verifier,
          displayName: data.user?.fullName ?? badge.trim(),
          role: data.user?.primaryRole ?? 'OPERATOR',
          lineCode: data.user?.machineAccess?.[0]?.machineCode ?? null,
        });
      } catch {
        /* offline cache optional */
      }
    } catch (err) {
      if (err instanceof Error && err.message === OPERATOR_ONLY_MSG) {
        clearAuth();
        await signOutSession();
        setError(OPERATOR_ONLY_MSG);
        return;
      }
      // Offline PIN path when network fails
      const networkFail =
        !navigator.onLine ||
        (err instanceof Error &&
          (/failed to fetch|network|offline|abort/i.test(err.message) || err.name === 'AbortError'));
      if (networkFail) {
        try {
          const { getAuthCache } = await import('../offline/db');
          const {
            verifyPinOffline,
            isAuthCacheFresh,
            isOfflineSessionValid,
          } = await import('../offline/offlinePin');
          const { setOfflineSession } = await import('../lib/authStore');
          const cached = await getAuthCache(badge.trim());
          if (
            cached &&
            isAuthCacheFresh(cached.cached_at) &&
            (await verifyPinOffline(
              pin,
              cached.pin_verifier,
              badge.trim(),
              sessionStorage.getItem('a59-device-id') || 'web'
            ))
          ) {
            if (isOperatorBuild() && cached.role && cached.role !== 'OPERATOR') {
              throw new Error(OPERATOR_ONLY_MSG);
            }
            const startedAt = Date.now();
            if (!isOfflineSessionValid(startedAt)) {
              throw new Error('Offline session expired — connect to the plant network to sign in');
            }
            const fake = {
              userId: `offline:${badge.trim()}`,
              username: badge.trim(),
              fullName: cached.display_name || badge.trim(),
              empCode: badge.trim(),
              email: null,
              roles: ['OPERATOR'],
              primaryRole: 'OPERATOR',
              processAccess: [
                { processCode: 'TM', level: 'WRITE' },
                { processCode: 'FUR', level: 'WRITE' },
                { processCode: 'STP', level: 'WRITE' },
                { processCode: 'DRW', level: 'WRITE' },
                { processCode: 'SWG', level: 'WRITE' },
              ],
              machineAccess: cached.line_code
                ? [{ machineCode: cached.line_code, level: 'WRITE' }]
                : [],
              offline: true,
            };
            setOfflineSession({ startedAt, userCode: badge.trim() });
            await afterLogin(fake);
            setError(null);
            return;
          }
        } catch (offlineErr) {
          if (offlineErr instanceof Error && offlineErr.message === OPERATOR_ONLY_MSG) {
            setError(OPERATOR_ONLY_MSG);
            return;
          }
        }
      }
      if (allowHeader && !isOperatorBuild()) {
        const role = 'OPERATOR';
        setDevRoleOverride(role);
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
          machineAccess: [
            { machineCode: 'A-59', level: 'WRITE' },
            { machineCode: 'RHF-03', level: 'WRITE' },
            { machineCode: 'RHF-04', level: 'WRITE' },
            { machineCode: 'RHF-05', level: 'WRITE' },
            { machineCode: 'STP-LINE', level: 'WRITE' },
            { machineCode: 'STP-01', level: 'WRITE' },
            { machineCode: 'DB-10T', level: 'WRITE' },
            { machineCode: 'DB-20T', level: 'WRITE' },
            { machineCode: 'DB-40T', level: 'WRITE' },
            { machineCode: 'DB-45T', level: 'WRITE' },
            { machineCode: 'DB-80T', level: 'WRITE' },
            { machineCode: 'DB-120T', level: 'WRITE' },
            { machineCode: 'DB-180T', level: 'WRITE' },
            { machineCode: 'DB-250T', level: 'WRITE' },
            { machineCode: 'SWG-01', level: 'WRITE' },
          ],
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
      if (superTokensOn !== true) {
        throw new Error('Staff email login needs SuperTokens Core — use Badge / PIN on this deploy');
      }
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
        _jsx("p", { className: "muted", children: isOperatorBuild()
          ? "Badge ID + 4-digit PIN — operators only"
          : "Badge ID + 4-digit PIN for operators, machine heads, and admin" }), /*#__PURE__*/
        superTokensOn === true && !isOperatorBuild() ? _jsxs("div", { className: "login-screen__modes", children: [/*#__PURE__*/
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
        ) : null,
        error && /*#__PURE__*/_jsx("div", { className: "error-strip", children: error }),
        mode === 'badge' || superTokensOn !== true ? /*#__PURE__*/
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
          SHOW_DEMO_CHIPS ? _jsxs("div", { className: "login-screen__demos", children: [/*#__PURE__*/
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
          ) : null, /*#__PURE__*/
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
