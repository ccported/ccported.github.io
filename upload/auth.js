const { UserManager }= oidc;

const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_euwC8WZao",
    client_id: "7d6gq18mtkru5ru55hodmeb5sh",
    redirect_uri: "https://ccported.click/upload/",
    response_type: "code",
    scope: "phone openid email",
};

// create a UserManager instance
export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export async function signOutRedirect () {
    const clientId = "7d6gq18mtkru5ru55hodmeb5sh";
    const logoutUri = "https://ccported.click/upload/auth.html";
    const cognitoDomain = "https://us-west-2euwc8wzao.auth.us-west-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
};