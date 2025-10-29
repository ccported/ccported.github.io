<script lang="ts">
    import CardGrid from "$lib/components/CardGrid.svelte";
    import Locked from "$lib/components/Locked.svelte";
    import Navigation from "$lib/components/Navigation.svelte";
    import Info from "$lib/components/Info.svelte";
    import { initializeTooling, SessionState, State } from "$lib/state.js";
    import { onMount } from "svelte";
    import { loadGames } from "$lib/loadCards.js";
    import { checkNotifications } from "$lib/checkNotifications.js";
    import { browser } from "$app/environment";

    let isAHost = $state(State.isAHost());
    let devMode = $state(true);
    let adblockEnabled = $state(SessionState.adBlockEnabled);
    let adsEnabled = $state(SessionState.adsEnabled);
    let streamingContent = $state("");
    onMount(async () => {
        await initializeTooling();

        // Don't wait up on this one (it can load in the background)
        checkNotifications();
        isAHost = State.isAHost();

        devMode = SessionState.devMode;
        adblockEnabled = SessionState.adBlockEnabled;
        adsEnabled = SessionState.adsEnabled;

        function injectBadAds() {
            const script = document.createElement("script");
            script.type = "text/javascript";
            script.src =
                "//pl27945791.effectivegatecpm.com/f9/0f/48/f90f487cd8f3cdf83690f6955c1b5655.js";
            document.body.appendChild(script);
        }
        if ((!isAHost && !adblockEnabled)) {
            console.log("[R][LAYOUT][BASE] Bad Ads enabled");
            injectBadAds();
        } else {
            if (isAHost && adsEnabled) {
                console.log("[R][LAYOUT][BASE] Good ads enabled");
            } else {
                console.log("[R][LAYOUT][BASE] No ads");
            }
        }

        // var chars = "~!@#$%^&*()_+{}|:'<>?`1234567890-=[]\\;/.,";

        // if (browser && window.innerWidth > 800) {
        //     setInterval(() => {
        //         streamingContent +=
        //             chars.split("")[Math.floor(Math.random() * chars.length)];

        //         streamingContent = streamingContent.slice(-75);
        //     }, 50);
        // }
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
    <div class="left">
        <h3>
            <b
                >Can't find what you're looking for? <a
                    href="https://discord.gg/GDEFRBTT3Z">Join the discord</a
                ></b
            >
        </h3>
        <p>
            CCPorted is not affiliated with or endorsed by any game developers
            or publishers. All games are property of their respective owners*
        </p>
        <p>
            DMCA Requests can be sent to <a
                href="mailto:ccported@ccported.click">ccported@ccported.click</a
            >
        </p>
        <p>
            Site, design, and development are protected under common law
            copyright; © {new Date().getFullYear()} CCPorted
        </p>
        <p>
            <a href="/tos/privacy_policy">Privacy Policy</a> |
            <a href="/tos/terms_of_service">Terms of Service</a>
        </p>
        <p>
            * BallZ, Nighttime Visitor, Tetris, Tic Tac Toe, Stack, and Reaction
            Rush are all owned and protected by CCPorted.
        </p>
        <p>
            For complaints about ad content, please contact us at <a
                href="mailto:ccported@ccported.click">ccported@ccported.click</a
            > or through the discord (see link above and in the navigation).
        </p>
        <h3>CCPORTED</h3>
        <p>CCPorted is the greatest place to play video games. The CCPorted team parses through hundreds of games and only adds the highest-quality games to our library, ensuring a high quality gaming experience for the users. Log in to get added to leaderboards and compete with your friends. Play all kinds of games from nostalgic classics to the latest hits. Our extensive ROM library also features over 300 titles from the late 90s and early 2000s. Join the Discord to get site updates and request games. New games are added each week, and games are updated regularly to ensure a bug-free experience.</p>
        <p>Join the discord to request the <i>Underground Document</i>, a Google Doc with information on how to access other links for the site.</p>
        <p>To view old notifications, visit the notifications page.</p>
        <h3>Partners</h3>
        <p>To become a partner, please contact us through the discord.</p>
    </div>
    <div class="license">
        <h3>CCPORTED SOFTWARE LICENSE INFORMATION</h3>
        <p>
            This software is licensed under the GNU Affero General Public
            License v3.0 (AGPL-3.0), with additional terms that restrict
            commercial use as described below.
        </p>

        <h4>NONCOMMERCIAL CLAUSE</h4>
        <p>
            You may not use, modify, distribute, or otherwise exploit this
            software, in whole or in part, for commercial purposes.
        </p>
        <p>
            "Commercial purposes" means any use that is intended for or directed
            toward commercial advantage or monetary compensation, including but
            not limited to: - Selling or licensing copies of the software, -
            Hosting, operating, or distributing the software as part of a paid
            service, - Using the software to generate revenue (advertising,
            subscriptions, etc.), - Integrating the software into commercial
            products or services.
        </p>
        <p>
            You may use, modify, and share this software freely for personal,
            educational, research, or other noncommercial purposes, provided
            that all modified versions and derivative works are distributed
            under the same license and made publicly available.
        </p>

        <h4>AGPL v3 LICENSE TERMS</h4>
        <p>
            This program is free software: you can redistribute it and/or modify
            it under the terms of the GNU Affero General Public License as
            published by the Free Software Foundation, either version 3 of the
            License, or (at your option) any later version.
        </p>
        <p>
            This program is distributed in the hope that it will be useful, but
            WITHOUT ANY WARRANTY; without even the implied warranty of
            MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
            Affero General Public License for more details.
        </p>
        <p>
            You should have received a copy of the GNU Affero General Public
            License along with this program. If not, see <a
                href="https://www.gnu.org/licenses/"
                >https://www.gnu.org/licenses/</a
            >.
        </p>
        <h4>LICENSE NOTICE</h4>
        <p>
            When redistributing this software or derivative works, you must
            include this full license text, clearly indicating that it is
            licensed under "AGPL v3 + NonCommercial Clause".
        </p>
    </div>
    <div class="info">
        <Info />
    </div>
</footer>
<div class="streaming-console">
    <!-- <code>{streamingContent}</code> -->
</div>

<style>
    .streaming-console {
        width: 100%;
        text-align: center;
    }
    footer {
        display: flex;
        flex-direction: row;
        color: #666;
        font-size: 14px;
        justify-content: space-around;
    }
    footer div {
        margin: 20px;
        max-width: 600px;
    }

    @media (max-width: 800px) {
        footer {
            flex-direction: column;
            align-items: center;
            text-align: center;
        }
        footer div {
            max-width: none;
        }
        footer .license {
            order: 1;
            text-align: left;
        }
    }
</style>
