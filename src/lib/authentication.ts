import { UserManager } from "oidc-client-ts";



export interface Tokens {
    accessToken: string | undefined;
    idToken: string | undefined;
    refreshToken: string | undefined;
}
const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_lg1qptg2n",
    client_id: "4d6esoka62s46lo4d398o3sqpi",
    redirect_uri: window.location.origin + "/auth/callback",
    response_type: "code",
    scope: "aws.cognito.signin.user.admin email openid phone profile"
};

export const userManager = new UserManager({
    ...cognitoAuthConfig
});


export async function signinRequest() {
    await userManager.signinRedirect();
}