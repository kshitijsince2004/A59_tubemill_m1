import SuperTokens from 'supertokens-web-js';
import Session from 'supertokens-web-js/recipe/session';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import { clearAuth, getAccessToken, setAccessToken } from './authStore';

let initialized = false;

export function initSuperTokensClient() {
  if (initialized) return;
  const apiDomain = window.location.origin;
  SuperTokens.init({
    appInfo: {
      appName: 'A59 Tube Mill M1',
      apiDomain,
      apiBasePath: '/api/auth',
    },
    recipeList: [
      EmailPassword.init(),
      Session.init({
        // Must match server Session.init({ getTokenTransferMethod: () => 'header' })
        tokenTransferMethod: 'header',
        onHandleEvent: (event) => {
          if (event.action === 'UNAUTHORISED' || event.action === 'SIGN_OUT') {
            clearAuth();
          }
        },
      }),
    ],
  });
  initialized = true;
}

/**
 * Sync bearer from SuperTokens web-js session storage.
 * Does NOT clear a badge-pin / header-captured token when ST frontend has no session
 * (custom /auth/badge-pin creates the session server-side and returns st-access-token).
 */
export async function syncAccessTokenFromSession() {
  try {
    if (!(await Session.doesSessionExist())) {
      return getAccessToken();
    }
    const token = await Session.getAccessToken();
    if (token) setAccessToken(token);
    return token ?? getAccessToken();
  } catch {
    return getAccessToken();
  }
}

export async function staffSignIn(email, password) {
  initSuperTokensClient();
  const result = await EmailPassword.signIn({
    formFields: [
      { id: 'email', value: email },
      { id: 'password', value: password },
    ],
  });
  if (result.status !== 'OK') {
    throw new Error(
      result.status === 'WRONG_CREDENTIALS_ERROR' ? 'Wrong email or password' : 'Sign-in failed'
    );
  }
  await syncAccessTokenFromSession();
  return result;
}

export async function signOutSession() {
  try {
    initSuperTokensClient();
    await Session.signOut();
  } catch {
    /* ignore */
  }
  clearAuth();
}

export { Session, EmailPassword };
