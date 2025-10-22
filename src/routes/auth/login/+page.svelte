<script lang="ts">
    import Navigation from "$lib/components/Navigation.svelte";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { createUserManager, signinRequest } from "$lib/authentication.js";
    import { SessionState } from "$lib/state.js";
    import { page } from "$app/state";

    let user: any = null;
    let loading = false;
    let error: string | null = null;

    async function signIn() {
        if (!browser) return;
        try {
            loading = true;
            await signinRequest(page.url);
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    async function signOut() {
        if (!browser) return;
        try {
            await (createUserManager(window.location.origin)).removeUser();
            user = null;
            SessionState.user = null;
            SessionState.loggedIn = false;
        } catch (err) {
            console.error(err);
        }
    }

    onMount(async () => {
        if (!browser) return;
        try {
            const stored = await (createUserManager(window.location.origin)).getUser();
            if (stored) {
                user = stored.profile || stored;
                SessionState.user = user;
                SessionState.loggedIn = true;
            }
        } catch (err) {
            console.error("Failed to get user", err);
        }
    });
</script>

<svelte:head>
    <title>Login - CCPorted</title>
</svelte:head>

<Navigation />

<main class="login-page">
    <div class="container">
        <div class="card">
            <h2>Sign in to CCPorted</h2>
            <p>Access account features like favorites and sync.</p>

            {#if user}
                <div class="user-info">
                    <img
                        src={user.picture || "/static/profile_pic.png"}
                        alt="Profile"
                    />
                    <div>
                        <div class="name">{user.name || user.email}</div>
                        <div class="email">{user.email}</div>
                    </div>
                </div>
                <div class="actions">
                    <button class="primary" on:click={signOut}>Sign out</button>
                </div>
            {:else}
                <div class="actions">
                    <button
                        class="primary"
                        on:click={signIn}
                        disabled={loading}
                    >
                        {#if loading}Signing in...{:else}Sign in with Cognito{/if}
                    </button>
                </div>
                {#if error}
                    <div class="error">{error}</div>
                {/if}
            {/if}
        </div>
    </div>
</main>

<style>
    .login-page {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 0;
    }
    .container {
        max-width: 720px;
        width: 100%;
        padding: 0 1rem;
    }
    .card {
        background: #fff;
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
        text-align: center;
    }
    .user-info {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        margin: 16px 0;
    }
    .user-info img {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        object-fit: cover;
    }
    .name {
        font-weight: 600;
    }
    .email {
        color: #666;
        font-size: 0.9rem;
    }
    .actions {
        margin-top: 16px;
    }
    button.primary {
        background: var(--theme-blue);
        color: white;
        padding: 10px 18px;
        border-radius: 10px;
        border: none;
        cursor: pointer;
    }
    button.primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .error {
        color: #b91c1c;
        margin-top: 12px;
    }
</style>
