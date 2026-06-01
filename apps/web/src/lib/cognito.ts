import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { setAuthToken, setRefreshToken, clearAllTokens } from "./auth-token";

const isCognito = process.env.NEXT_PUBLIC_AUTH_MODE === "cognito";
const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";

let userPool: CognitoUserPool | null = null;
if (isCognito && poolId && clientId) {
  userPool = new CognitoUserPool({
    UserPoolId: poolId,
    ClientId: clientId,
  });
}

export function getCognitoUserPool(): CognitoUserPool | null {
  return userPool;
}

export async function loginWithCognito(email: string, password: string): Promise<string> {
  if (!userPool) {
    throw new Error(
      "Cognito User Pool is not configured. Please check your environment variables.",
    );
  }

  const authDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const idToken = session.getIdToken().getJwtToken();
        const refreshToken = session.getRefreshToken().getToken();

        // Save to cookies so standard API requests have the bearer token
        setAuthToken(idToken);
        setRefreshToken(refreshToken);

        resolve(idToken);
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Auto-complete force change password challenge using the same password they just typed
        cognitoUser.completeNewPasswordChallenge(
          password,
          {},
          {
            onSuccess: (session) => {
              const idToken = session.getIdToken().getJwtToken();
              const refreshToken = session.getRefreshToken().getToken();
              setAuthToken(idToken);
              setRefreshToken(refreshToken);
              resolve(idToken);
            },
            onFailure: (err) => {
              reject(err);
            },
          },
        );
      },
    });
  });
}

export function logoutCognito() {
  clearAllTokens();
  if (userPool) {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
  }
}

/**
 * Checks and automatically refreshes the Cognito token if expired.
 * Updates the cookie with the fresh ID Token.
 */
export async function getFreshCognitoToken(): Promise<string | null> {
  if (!userPool) return null;

  const currentUser = userPool.getCurrentUser();
  if (!currentUser) return null;

  return new Promise((resolve) => {
    currentUser.getSession((err: any, session: any) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
      } else {
        const idToken = session.getIdToken().getJwtToken();
        setAuthToken(idToken);
        resolve(idToken);
      }
    });
  });
}
