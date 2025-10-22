import { UserManager } from "oidc-client-ts";



export interface Tokens {
    accessToken: string | undefined;
    idToken: string | undefined;
    refreshToken: string | undefined;
}


let userManager: UserManager | null = null;
export function createUserManager(origin: String) {
    if (userManager) {
        return userManager;
    }
    const cognitoAuthConfig = {
        authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_lg1qptg2n",
        client_id: "4d6esoka62s46lo4d398o3sqpi",
        redirect_uri: origin + "/auth/callback",
        response_type: "code",
        scope: "aws.cognito.signin.user.admin email openid phone profile"
    };
    userManager = new UserManager({
        ...cognitoAuthConfig
    });
    return userManager;
}


export async function signinRequest(url: URL) {
    await (createUserManager(url.origin)).signinRedirect();
}