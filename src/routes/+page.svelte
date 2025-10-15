<script lang="ts">
    import CardGrid from "$lib/components/CardGrid.svelte";
    import Locked from "$lib/components/Locked.svelte";
    import Navigation from "$lib/components/Navigation.svelte";
    import Info from "$lib/components/Info.svelte";
    import { initializeTooling, SessionState, State } from "$lib/state.js";
    import { onMount } from "svelte";
    import { loadGames } from "$lib/loadCards.js";
    import { checkNotifications } from "$lib/checkNotifications.js";

    let isAHost = $state(State.isAHost());
    let devMode = $state(true);
    let adblockEnabled = $state(SessionState.adBlockEnabled);
    let adsEnabled = $state(SessionState.adsEnabled);
    onMount(async () => {
        await initializeTooling();

        await checkNotifications();
        isAHost = State.isAHost();

        devMode = SessionState.devMode;
        adblockEnabled = SessionState.adBlockEnabled;
        adsEnabled = SessionState.adsEnabled;
    });
</script>

<svelte:head>
    <title>CCPorted</title>
    <meta
        name="description"
        content="Hundreds of games available to play instantly, for free, unblocked, in your browser."
    />
</svelte:head>

<div class="container">
    <div class="background"></div>
    <Navigation />
    <CardGrid />
</div>

<footer>
    <h3>
        <b
            >Can't find what you're looking for? <a
                href="https://discord.gg/GDEFRBTT3Z">Join the discord</a
            ></b
        >
    </h3>
    <p>
        CCPorted is not affiliated with or endorsed by any game developers or
        publishers. All games are property of their respective owners.
    </p>
    <p>
        DMCA Requests can be sent to <a href="mailto:ccported@ccported.click"
            >ccported@ccported.click</a
        >
    </p>
    <p>
        Site, design, and development are protected under common law copyright;
        © {new Date().getFullYear()} CCPorted
    </p>
    <p>
        <a href="/tos/privacy_policy">Privacy Policy</a> |
        <a href="/tos/terms_of_service">Terms of Service</a>
    </p>
    <Info />
</footer>

<style>
    footer {
        text-align: center;
        color: #666;
        margin: 20px 0;
        font-size: 14px;
    }
</style>
