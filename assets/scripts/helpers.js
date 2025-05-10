window.ccPorted = window.ccPorted || {};
const COGNITO_DOMAIN = "https://us-west-2lg1qptg2n.auth.us-west-2.amazoncognito.com"; // Replace with your Cognito domain
const CLIENT_ID = "4d6esoka62s46lo4d398o3sqpi"; // Replace with your App Client ID
const REDIRECT_URI = window.location.origin; 
const isFramed = window !== window.top;
const isMobile = /Mobi/.test(navigator.userAgent);

let redirectToProfileAfterLogin = false;
if (!isFramed) {
    window.ccPorted.config = window.ccPorted.config || {};
    window.ccPorted.config.stateSyncEnabled = false;
}
window.addEventListener("load", () => {
    const login = document.querySelector('.loggedInReplacable');
    if (login) {
        login.addEventListener('click', (e) => {
            if (login.textContent === "Login") {
                e.preventDefault();
                const redirect = window.location.origin;
                const scopes = ["email", "openid", "phone", "aws.cognito.signin.user.admin"];
                const baseURL = "https://us-west-2lg1qptg2n.auth.us-west-2.amazoncognito.com/login";
                const clientID = "4d6esoka62s46lo4d398o3sqpi";
                const responseType = "code";
                window.location.href = `${baseURL}?client_id=${clientID}&response_type=${responseType}&scope=${scopes.join("+")}&redirect_uri=${redirect}`;
                return false;
            }
        })
    }
});
function checkAndStartMining() {
    return new Promise(async (resolve) => {
        // Check for existing mining consent before showing the modal
        const miningConsent = localStorage.getItem('mining-consent');
        const miningExpiryStr = localStorage.getItem('mining-consent-expiry');
        await window.ccPorted.adsLoadPromise;
        if (miningConsent === 'true' && miningExpiryStr && !window.ccPorted.adBlockEnabled) {
            window.ccPorted.miningLoading = true;
            const miningExpiry = new Date(miningExpiryStr);
            if (miningExpiry > new Date()) {
                // Valid consent exists, start mining immediately without requiring toggle interaction
                if (!window.mining) {
                    // Load mining script if needed
                    if (!window.miningScriptLoaded) {
                        const script = document.createElement('script');
                        script.src = '/assets/scripts/m.js';
                        script.onload = function () {
                            if (window.startMining) {
                                window.startMining();
                                window.ccPorted.miningLoaded = true;
                                window.ccPorted.miningLoading = false;
                                resolve(true);
                            }
                        };
                        document.body.appendChild(script);
                        window.miningScriptLoaded = true;
                    } else if (window.startMining) {
                        window.startMining();
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(true);
                }
            } else {
                resolve(false);
            }
        } else {
            window.ccPorted.miningLoading = false;
            window.ccPorted.miningLoaded = false;
            resolve(false);
        }
    });
};

function log(...args) {
    console.log("[CCPORTED]: ", ...args);
    if (window.ccPorted?.stats) {
        window.ccPorted.stats.log(...args);
    }
}
function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
}
function shortcut(keys, cb) {
    log(`Creating shortcut for keys ${keys}, calling ${cb.name}`);
    var keyMap = {};
    for (const key of keys) {
        keyMap[key] = false;
    }
    document.addEventListener("keydown", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = true;
        }
        if (check()) {
            cb();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = false;
        }
    });
    function check() {
        var allPressed = true;
        for (const key of keys) {
            if (!keyMap[key]) {
                allPressed = false;
            }
        }
        return allPressed;
    }
}
function decamelize(string) {
    // string are in camelcase
    // should end up as "Camel Case"
    let denormalized = "";
    for (let i = 0; i < string.length; i++) {
        if (string[i] === string[i].toUpperCase() && ((string[i + 1] && string[i + 1] === string[i + 1].toUpperCase()) || !string[i + 1])) {
            denormalized += " " + string[i];
        } else {
            denormalized += string[i];
        }
    }
    // capitalize first character
    denormalized = denormalized[0].toUpperCase() + denormalized.slice(1);
    return denormalized;
}
function createNotif(popupData) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 800px;
        min-width: 500px;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 99999;
        font-family: Arial, sans-serif;
    `;
    if (popupData.autoClose) {
        const meter = document.createElement("div");
        meter.classList.add("meter");
        meter.style.cssText = `
            margin: 0;
            width: 100%;
            height: 10px;
            background-color: rgba(0,0,255,1);
            display: block;
            position: absolute;
            border-radius: 10px;
            z-index: 9;
            top: 0;
            left: 0;
            animation: meter-animation ${popupData.autoClose}s linear forwards;
        `;
        popup.appendChild(meter);

        setTimeout(() => {
            popup.style.animation = `fade 0.5s`;
            setTimeout(() => {
                popup.remove()
            }, 500);
        }, popupData.autoClose * 1000)
    }
    const popupContent = document.createElement("div");
    const message = document.createElement('p');
    message.textContent = popupData.message;
    message.style.marginBottom = '10px';
    message.style.color = 'white';
    let link;
    if (popupData.cta) {
        link = document.createElement('a');
        link.href = popupData.cta.link;
        link.textContent = popupData.cta.text;
        link.style.cssText = `
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
    }
    if (!popupData.autoClose) {
        const closeButton = document.createElement('a');
        closeButton.href = 'javascript:void(0)';
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            display: inline-block;
            background-color: rgb(248,0,0);
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
        closeButton.onclick = () => popup.remove();
    }
    const linkRow = document.createElement('div');
    linkRow.style.display = 'flex';
    linkRow.style.justifyContent = 'space-between';
    if (popupData.actions && popupData.actions.length >= 1) {
        const actionContainer = document.createElement("div");
        for (const action of popupData.actions) {
            const [actionName, actionFunc, color] = action;
            let button = document.createElement("button");
            button.style.cssText = `
            display: inline-block;
            background-color: ${(color) ? color : '#4CAF50'};
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
            border: 1px solid ${(color) ? color : '#4CAF50'};
            margin: 5px;
            cursor: pointer;
        `;
            button.onclick = () => {
                popup.remove();
                actionFunc();
            };
            button.innerText = actionName;
            actionContainer.appendChild(button);
        }
        linkRow.appendChild(actionContainer);
    }
    if (popupData.cta) {
        linkRow.appendChild(link);
    }
    if (!popupData.autoClose) {
        linkRow.appendChild(closeButton);
    }
    if (popupData.fullLink) {
        popup.style.cursor = "pointer";
        popup.addEventListener("click", () => {
            window.location.assign(popupData.fullLink);
        })
    }

    popupContent.appendChild(message);
    popupContent.appendChild(linkRow);
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
}
function refreshAWSCredentials() {
    return new Promise((resolve, reject) => {
        AWS.config.credentials.expired = true;
        AWS.config.credentials.refresh((error) => {
            if (error) {
                reject(error);
                log("Failed to refresh credentials:", error);
                if(sessionStorage.getItem("refreshed") !== "true"){
                    sessionStorage.setItem("refreshed", "true");
                    window.location.reload();
                }
                log("Failed to refresh credentials:", error);
                } else {
                log("Credentials refreshed successfully");
                resolve();
            }
        });
    });
}
function parseJwt(token) {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(base64));
    } catch (e) {
        log("[ERROR] Invalid JWT token:", e);
        return null;
    }
}
function isTokenExpired(tokenData) {
    if (!tokenData || !tokenData.exp) return true;
    const expiryTime = tokenData.exp * 1000;
    return Date.now() >= expiryTime;
}

async function importJSON(path) {
    let url;
    if (path.startsWith("/") && !path.startsWith("//")) {
        url = new URL(path, window.location.origin);
    } else {
        url = new URL(path);
    }
    url.searchParams.append('_', Date.now());

    const res = await fetch(path, {
        method: "GET",
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
    return res.json();
}
async function initializeUnathenticated() {
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'us-west-2:8ffe94a1-9042-4509-8e65-4efe16e61e3e'
    });
    log('Configured AWS SDK with unauthenticated credentials');
    return null;
}
async function initializeAuthenticated(idToken, accessToken, refreshToken) {

    // Decode token
    let userData = parseJwt(idToken);
    // Check if token is expired
    if (isTokenExpired(userData)) {
        log("ID token expired, attempting refresh...");
        const newTokens = await refreshTokens(refreshToken);
        if (!newTokens) {
            log("[ERROR] Failed to refresh token. User must log in again.");
            window.location.assign("/login"); // Redirect to login page
            return null;
        }
        userData = parseJwt(newTokens.id_token);
        if(isTokenExpired(userData)){
            console.log("ok now what the heck")
        }
    }
    log("User logged in, initializing credentials")
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'us-west-2:8ffe94a1-9042-4509-8e65-4efe16e61e3e',
        RoleSessionName: userData.sub
    });
    const surl = "cognito-idp.us-west-2.amazonaws.com/us-west-2_lg1qptg2n";
    AWS.config.credentials.params.Logins =
        AWS.config.credentials.params.Logins || {};
    AWS.config.credentials.params.Logins[surl] = idToken;
    await refreshAWSCredentials();
    const otherData = await window.ccPorted.identityProvider.getUser({
        AccessToken: accessToken
    }).promise();
    log("User attributes recieved", otherData);
    const userDataJSON = otherData.UserAttributes.reduce((acc, { Name, Value }) => {
        acc[Name] = Value;
        return acc;
    }, {});
    const user = {
        ...userData,
        attributes: userDataJSON
    };

    if(redirectToProfileAfterLogin){
        window.location.assign("/profile/")
    }
    return user;
}
async function initializeAWS() {
    window.ccPorted["awsReady"] = false;
    if (typeof AWS == "undefined") {
        log("AWS SDK not loaded, loading...");
        const sdk = document.createElement("script");
        sdk.src = "https://sdk.amazonaws.com/js/aws-sdk-2.1030.0.min.js";
        document.head.appendChild(sdk);
        await new Promise((r, rr) => {
            log("Waiting for AWS SDK to load...");
            sdk.onload = r;
        });
        log("AWS SDK loaded");
    }
    window.ccPorted.AWS = AWS;
    AWS.config.update({ region: "us-west-2" });
    window.ccPorted["identityProvider"] = new AWS.CognitoIdentityServiceProvider({
        region: 'us-west-2'
    });
    let idToken = localStorage.getItem("[ns_ccported]_idToken");
    let accessToken = localStorage.getItem("[ns_ccported]_accessToken");
    let refreshToken = localStorage.getItem("[ns_ccported]_refreshToken");
    let user = null;
    if (!idToken || !accessToken) {
        log("[WARN] No valid tokens found. Checking for auth code...");
        const authCode = new URLSearchParams(window.location.search).get("code");

        if (authCode) {
            log("Auth code found. Exchanging for tokens...");
            // if the auth code exists, the user just logged in
            redirectToProfileAfterLogin = true;

            const tokens = await exchangeAuthCodeForTokens(authCode);
            if (!tokens) {
                log("[ERROR] Failed to exchange auth code for tokens.");
                user = initializeUnathenticated();
                return user;
            }
            idToken = tokens.id_token;
            accessToken = tokens.access_token;
            refreshToken = tokens.refresh_token;
            log("Successfully retrieved tokens")
            user = await initializeAuthenticated(idToken, accessToken, refreshToken);
        } else {
            log("[WARN] No auth code found in URL. User may need to log in.");
            user = await initializeUnathenticated();
        }
    } else {
        log("Tokens found. Initializing user...");
        user = await initializeAuthenticated(idToken, accessToken, refreshToken);

    }
    window.ccPorted["s3Client"] = new AWS.S3({
        region: "us-west-2",
        RoleSessionName: user?.sub || "web-identity"
    });
    window.ccPorted["documentClient"] = new AWS.DynamoDB.DocumentClient({
        region: "us-west-2",
        RoleSessionName: user?.sub || "web-identity"
    });
    window.ccPorted["awsReady"] = true;
    window.ccPorted["user"] = user;
    window.ccPorted.getUser = () => user;

}
async function exchangeAuthCodeForTokens(authCode) {
    try {
        const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                code: authCode
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Store tokens in localStorage
        localStorage.setItem("[ns_ccported]_accessToken", data.access_token);
        localStorage.setItem("[ns_ccported]_idToken", data.id_token);
        localStorage.setItem("[ns_ccported]_refreshToken", data.refresh_token);
        window.history.replaceState({}, document.title, REDIRECT_URI); // Remove auth code from URL

        return data;
    } catch (error) {
        log("[ERROR] Error exchanging auth code:", error);
        return null;
    }
}
async function refreshTokens(refreshToken) {
    if (!refreshToken) {
        log("[WARN] No refresh token available.");
        return null;
    }

    try {
        const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: CLIENT_ID,
                refresh_token: refreshToken
            })
        });

        const data = await response.json();
        if (data.error) {
            if (data.error === "invalid_grant") {
                log("[ERROR] Invalid refresh token. Clearing stored tokens and redirecting to login.");
                localStorage.removeItem("[ns_ccported]_accessToken");
                localStorage.removeItem("[ns_ccported]_idToken");
                localStorage.removeItem("[ns_ccported]_refreshToken");
                window.location.assign("/login");
            }
            throw new Error(data.error || "Token refresh failed");
        }

        // Store new tokens
        localStorage.setItem("[ns_ccported]_accessToken", data.access_token);
        localStorage.setItem("[ns_ccported]_idToken", data.id_token);

        log("Tokens refreshed successfully");
        return data;
    } catch (error) {
        log("[ERROR] Error refreshing token:", error);
        return null;
    }
}

window.ccPorted.getUserTokens = () => {
    return {
        accessToken: localStorage.getItem("[ns_ccported]_accessToken"),
        idToken: localStorage.getItem("[ns_ccported]_idToken"),
        refreshToken: localStorage.getItem("[ns_ccported]_refreshToken")
    };
}
window.ccPorted.downloadFile = (key) => {
    return new Promise((resolve, reject) => {
        window.ccPorted.s3Client.getObject({
            Bucket: 'ccporteduserobjects',
            Key: `${window.ccPorted.user.sub}/${key}`
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
window.ccPorted.uploadFile = (file, key, customparams = {}) => {
    return new Promise((resolve, reject) => {
        const uploadParams = {
            Bucket: 'ccporteduserobjects',
            Key: `${window.ccPorted.user.sub}/${key}`,
            Body: file,
            ContentType: file.type,
            ...customparams
        }
        window.ccPorted.s3Client.upload(uploadParams, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    });
}
window.ccPorted.updateUser = (attributes) => {
    return new Promise((resolve, reject) => {
        window.ccPorted.identityProvider.updateUserAttributes({
            AccessToken: window.ccPorted.getUserTokens().accessToken,
            UserAttributes: Object.entries(attributes).map(([Name, Value]) => {
                return {
                    Name,
                    Value
                }
            })
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
window.ccPorted.query = (...args) => {
    const [partitionKeyName, partitionKey, tableName, otherData] = args;
    if (typeof partitionKeyName == "object") {
        return new Promise((resolve, reject) => {
            window.ccPorted.documentClient.query(partitionKeyName, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            KeyConditionExpression: `${partitionKeyName} = :partitionKey`,
            ExpressionAttributeValues: {
                ":partitionKey": partitionKey,
            },
            ...otherData
        }
        window.ccPorted.documentClient.query(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
window.ccPorted.getUser = () => {
    if (window.ccPorted.user) {
        return user;
    } else {
        return window.ccPorted.userPromise;
    }
}
window.ccPorted.userPromise = new Promise(async (resolve, reject) => {
    await initializeAWS();
    const userData = window.ccPorted.user;
    if (userData) {
        const loggedInReplacable = document.querySelector('.loggedInReplacable');
        if (loggedInReplacable) {
            loggedInReplacable.textContent = userData["cognito:username"];
            loggedInReplacable.href = "/profile/";
        }
        resolve(userData);
    } else {
        resolve(null);
        console.log("[UserPromise]: Failed to inizialize user")
    }
});
window.ccPorted.miningLoadPromise = new Promise(async (resolve) => {
    const mining = await checkAndStartMining();
    window.ccPorted.miningEnabled = mining;
    console.log("ttt", mining, window.ccPorted.miningEnabled)
    resolve(window.ccPorted.miningEnabled);
});
