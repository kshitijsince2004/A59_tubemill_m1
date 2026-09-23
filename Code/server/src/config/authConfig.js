import SuperTokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { middleware as stMiddleware, errorHandler as stErrorHandler } from 'supertokens-node/framework/express';
import { config } from '../config';

let initialized = false;

export function initSuperTokens() {
  if (!config.superTokensEnabled) {
    console.warn('[auth] SuperTokens disabled (no SUPERTOKENS_CONNECTION_URI)');
    return false;
  }
  if (initialized) return true;

  SuperTokens.init({
    framework: 'express',
    supertokens: {
      connectionURI: config.superTokensConnectionUri,
      ...(config.superTokensApiKey ? { apiKey: config.superTokensApiKey } : {})
    },
    appInfo: {
      appName: 'A59 Tube Mill M1',
      apiDomain: config.apiDomain,
      websiteDomain: config.websiteDomain,
      apiBasePath: config.apiBasePath,
      websiteBasePath: config.websiteBasePath
    },
    recipeList: [
    EmailPassword.init(),
    Session.init({
      getTokenTransferMethod: () => 'header',
      override: {
        functions: (original) => ({
          ...original,
          createNewSession: async (input) => {
            const session = await original.createNewSession(input);
            const stUserId = session.getUserId();
            const { loadGrantsBySuperTokensUserId, loadGrantsByUserId } = await import(
              '../services/authService.js'
            );
            const grants =
            (await loadGrantsBySuperTokensUserId(stUserId)) ?? (
            await loadGrantsByUserId(stUserId));
            if (grants) {
              await session.mergeIntoAccessTokenPayload({
                appUserId: grants.userId,
                username: grants.username,
                roles: grants.roles,
                processAccess: JSON.parse(JSON.stringify(grants.processAccess)),
                machineAccess: JSON.parse(JSON.stringify(grants.machineAccess))
              });
              try {
                const existing = await Session.getAllSessionHandlesForUser(stUserId);
                for (const handle of existing) {
                  if (handle !== session.getHandle()) {
                    await Session.revokeSession(handle);
                  }
                }
              } catch {

                /* ignore revoke races */}
            }
            return session;
          }
        })
      }
    })]

  });

  initialized = true;
  console.log('[auth] SuperTokens initialized');
  return true;
}

export function getSuperTokensMiddleware() {
  return stMiddleware();
}

export function getSuperTokensErrorHandler() {
  return stErrorHandler();
}

export { SuperTokens, Session, EmailPassword };