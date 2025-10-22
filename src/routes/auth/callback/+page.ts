// Client-only route to process the OIDC redirect, persist tokens, and bounce home
import { redirect } from '@sveltejs/kit';
export const ssr = false;
export const csr = true;

import { createUserManager } from '$lib/authentication.js';
import { SessionState } from '$lib/state.js';
import { create } from 'domain';
import { page } from '$app/state';
import { UserManager } from 'oidc-client-ts';

const TOKEN_STORAGE_KEY = 'ccported_tokens';

type StoredTokens = {
	accessToken?: string;
	idToken?: string;
	refreshToken?: string;
	expiresAt?: number; // epoch ms
};

export async function load() {
	// This runs in the browser only (ssr=false)
	const usernManager = createUserManager(page.url.origin);
	try {
		// Complete the sign-in redirect flow and obtain the user
		const user = await usernManager.signinCallback(window.location.href);

		const tokens: StoredTokens = {
			accessToken: user?.access_token,
			idToken: user?.id_token,
			refreshToken: user?.refresh_token,
			// oidc-client-ts provides expires_at in seconds since epoch
			expiresAt: user?.expires_at ? user.expires_at * 1000 : undefined
		};

		// Persist tokens for initializeTooling to read later
		try {
			localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
		} catch (e) {
			console.warn('[auth/callback] Failed to store tokens', e);
		}

		// Stash profile in SessionState for immediate use this navigation cycle
		if (user?.profile) {
			SessionState.user = user.profile as any;
			SessionState.loggedIn = true;
		}
	} catch (err) {
		console.error('[auth/callback] signinCallback failed, trying signinRedirectCallback()', err);
		try {
			const user = await (usernManager as any).signinRedirectCallback?.(window.location.href);
			const tokens: StoredTokens = {
				accessToken: user?.access_token,
				idToken: user?.id_token,
				refreshToken: (user as any)?.refresh_token,
				expiresAt: user?.expires_at ? user.expires_at * 1000 : undefined
			};
			localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
			if (user?.profile) {
				SessionState.user = user.profile as any;
				SessionState.loggedIn = true;
			}
		} catch (err2) {
			console.error('[auth/callback] Redirect callback also failed', err2);
		}
	}

	// Navigate back to the home page (or prior route if desired later)
	throw redirect(302, '/');
}

