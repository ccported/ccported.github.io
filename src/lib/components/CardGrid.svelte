<script lang="ts">
    import {
        decamelize,
        detectAdBlockEnabled,
        getCommitHash,
        openGame,
    } from "$lib/helpers.js";
    import {
        initializeTooling,
        SessionState,
        State,
        testSingleServer,
    } from "$lib/state.js";
    import type { Game } from "$lib/types/game.js";
    import { onMount } from "svelte";
    import GameCard from "./GameCard.svelte";
    import Ad from "./Ad.svelte";
    import { findAHosts } from "$lib/types/servers.js";
    import { browser } from "$app/environment";
    import { loadGames } from "$lib/loadCards.js";
    import { goto } from "$app/navigation";

    let searchIsOpen = $state(false);
    let games = $state<Game[]>([]);
    let adsEnabled = $state(false);
    let adSlots = $state<{ sidebar: string; grid: string } | null>(null);

    const adSlotConfig = {
        "ccported.github.io": {
            sidebar: "69fd2258-841e-496e-b471-7fee303347da",
            grid: "1327f13c-fb3f-45df-9616-2c76dacf8707",
        },
        "ccported.click": {
            sidebar: "52cde221-3941-473c-afbc-5376c9ae5f76",
            grid: "29d0156c-2d0c-4d77-b80c-6a3c21b13dd2",
        },
    };

    // Sort options
    type SortType = "default" | "az" | "za" | "clicksAsc" | "clicksDesc" | "new" | "old";
    let sortType = $state<SortType>("default");

    function getSortedGames() {
        let sorted = [...games];
        switch (sortType) {
            case "new":
                sorted.sort((a, b) => b.uploadedTimestamp - a.uploadedTimestamp);
                break;
            case "old":
                sorted.sort((a, b) => a.uploadedTimestamp - b.uploadedTimestamp);
                break;
            case "az":
                sorted.sort((a, b) => a.fName.localeCompare(b.fName));
                break;
            case "za":
                sorted.sort((a, b) => b.fName.localeCompare(a.fName));
                break;
            case "clicksAsc":
                sorted.sort((a, b) => (a.clicks ?? 0) - (b.clicks ?? 0));
                break;
            case "clicksDesc":
                sorted.sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
                break;
            default:
                // Original sort: starred, new, updated, clicks
                sorted.sort((a, b) => {
                    let aIsStarred = State.pinnedGames.includes(a.gameID);
                    let bIsStarred = State.pinnedGames.includes(b.gameID);
                    if (aIsStarred && !bIsStarred) return -1;
                    if (!aIsStarred && bIsStarred) return 1;
                    let aIsUpdated =
                        Date.now() - a.updatedTimestamp < 604800000 &&
                        a.updatedTimestamp &&
                        a.updatedTimestamp > 0;
                    let aIsNew =
                        Date.now() - a.uploadedTimestamp < 604800000 &&
                        a.uploadedTimestamp &&
                        a.uploadedTimestamp > 0;
                    let bIsUpdated =
                        Date.now() - b.updatedTimestamp < 604800000 &&
                        b.updatedTimestamp &&
                        b.updatedTimestamp > 0;
                    let bIsNew =
                        Date.now() - b.uploadedTimestamp < 604800000 &&
                        b.uploadedTimestamp &&
                        b.uploadedTimestamp > 0;
                    if (aIsNew && !bIsNew) return -1;
                    if (!aIsNew && bIsNew) return 1;
                    if (aIsUpdated && !bIsUpdated) return -1;
                    if (!aIsUpdated && bIsUpdated) return 1;
                    const aClicks = a.clicks ?? 0;
                    const bClicks = b.clicks ?? 0;
                    return bClicks - aClicks;
                });
        }
        console.log(
            `[R][CardGrid][getSortedGames] Sorted games by ${sortType}, found ${sorted.length} games.`,
        );
        return sorted;
    }

    function updateSearchResults() {
        const sortedGames = getSortedGames();
        searchResults = sortedGames
            .map((game: Game) => {
                return { game, score: matchesSearch(game, searchTerm) };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score || b.game.clicks - a.game.clicks);
    }

    let searchTerm = $state("");

    function normalizeString(str: string) {
        return str.toLowerCase();
    }

    function matchesSearch(game: Game, term: string) {
        term = normalizeString(term);
        if (term === "") return 1;
        let score = 0;
        for (const key of Object.keys(game) as (keyof Game)[]) {
            const value = game[key];
            if (typeof value === "string") {
                const normalized = normalizeString(value);
                const split = normalized.split(" ");
                const termSplit = term.split(" ");
                for (const t of termSplit) {
                    if (split.includes(t)) {
                        score += 1;
                    } else if (split.some((s) => s.startsWith(t))) {
                        score += 0.5;
                    }
                }
            } else if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === "string") {
                        const normalized = normalizeString(decamelize(item));
                        const split = normalized.split(" ");
                        const termSplit = term.split(" ");
                        for (const t of termSplit) {
                            if (split.includes(t)) {
                                score += 1;
                            } else if (split.some((s) => s.startsWith(t))) {
                                score += 0.5;
                            }
                        }
                    }
                }
            }
        }
        return score;
    }
    let searchInput: HTMLInputElement;
    let selectedIndex = $state(0);
    let resultsListElement: HTMLUListElement;
    let searchResults = $state<{ game: Game; score: number }[]>([]);
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    let firstInput = true;
    function oninput(e: Event) {
        const target = e.target as HTMLInputElement;
        searchTerm = target.value;
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        if (firstInput) {
            firstInput = false;
            updateSearchResults();
            selectedIndex = 0;
            return;
        }
        debounceTimeout = setTimeout(() => {
            updateSearchResults();
            selectedIndex = 0;
        }, 150);
    }

    function toggleSearch(term?: string) {
        searchIsOpen = !searchIsOpen;
        if (searchIsOpen) {
            if (term) {
                searchTerm = term;
            }
            setTimeout(() => {
                searchInput.focus();
                if (term) {
                    searchInput.value = term;
                    const inputEvent = new Event("input", { bubbles: true });
                    searchInput.dispatchEvent(inputEvent);
                }
            }, 0);
        } else {
            firstInput = true;
            searchTerm = "";
            updateSearchResults();
            selectedIndex = -1;
        }
    }

    const searchRegex = /[a-z0-9]/i;
    let adBlock = $state(false);
    let commitHash = $state("");

    onMount(async () => {
        commitHash = (await getCommitHash()) || "";
        await initializeTooling();

        games = await loadGames();

        document.addEventListener("keydown", (e) => {
            if (!searchInput) return;
            // Ignore keyboard shortcuts, special keys, non a-z0-9, or backspace, enter, delete, etc.
            if (
                e.key.length == 1 &&
                searchRegex.test(e.key.toLowerCase()) &&
                !searchIsOpen &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.altKey
            ) {
                e.preventDefault();
                toggleSearch();
                searchInput.value += e.key;
                const inputEvent = new Event("input", { bubbles: true });
                searchInput.dispatchEvent(inputEvent);
            } else if (searchIsOpen) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (searchResults.length > 0) {
                        selectedIndex =
                            (selectedIndex + 1) % searchResults.length;
                    }
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (searchResults.length > 0) {
                        selectedIndex =
                            (selectedIndex - 1 + searchResults.length) %
                            searchResults.length;
                    }
                } else if (
                    e.key === "Enter" &&
                    selectedIndex > -1 &&
                    searchResults[selectedIndex]
                ) {
                    e.preventDefault();
                    openGame(searchResults[selectedIndex].game);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    toggleSearch();
                }
            }
        });

        if (SessionState.ssr) return;

        await detectAdBlockEnabled();
        console.log(
            "[R][CardGrid][Mount] AdBlock Enabled:",
            SessionState.adBlockEnabled,
        );
        adBlock = SessionState.adBlockEnabled;
        adsEnabled = SessionState.adsEnabled;
        if (adsEnabled) {
            const host = browser ? window.location.hostname : "<SSR_HOST>";
            if (host in adSlotConfig) {
                adSlots = adSlotConfig[host as keyof typeof adSlotConfig];
            }
            (async () => {
                const aHosts = await findAHosts();
                if (!aHosts) {
                    adsEnabled = false;
                    SessionState.adsEnabled = false;
                    return;
                }

                const aHostData = aHosts.find((h) => h.hostname === host);
                if (aHostData && aHostData.acode) {
                    const scriptId = `ad-script-${aHostData.acode}`;
                    if (document.getElementById(scriptId)) return;

                    const script = document.createElement("script");
                    script.id = scriptId;
                    script.src = `//monu.delivery/site/${aHostData.acode}`;
                    script.setAttribute("data-cfasync", "false");
                    script.defer = true;
                    document.head.appendChild(script);
                } else {
                    console.log(
                        "[R][CardGrid][Mount] No valid AHost for this domain:",
                        host,
                    );
                    adsEnabled = false;
                    SessionState.adsEnabled = false;
                }
            })();
        }
    });

    $effect(() => {
        if (selectedIndex > -1 && resultsListElement) {
            const selectedElement =
                resultsListElement.querySelector(".selected");
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                });
            }
        }
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="search-overlay"
    class:visible={searchIsOpen}
    class:hidden={!searchIsOpen}
    onclick={(e) => {
        if (e.target === e.currentTarget) {
            toggleSearch();
        }
    }}
>
    <!-- glass morphic floating center search -->
    <div class="search">
        <input
            id="search"
            type="text"
            {oninput}
            placeholder="Search..."
            autocomplete="off"
            autocorrect="off"
            autosave="off"
            bind:this={searchInput}
            bind:value={searchTerm}
        />
        <div class="results-inner-container">
            <ul class="results" bind:this={resultsListElement}>
                {#if searchResults.length === 0}
                    <li class="search-result-row">No results found</li>
                {/if}
                {#each searchResults as result, i (result.game.gameID)}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <li
                        class="search-result-row"
                        class:selected={i === selectedIndex}
                        onclick={() => openGame(result.game)}
                    >
                        <img
                            src={`https://cdn.jsdelivr.net/gh/ccported/games@${commitHash}/${result.game.gameID}${result.game.thumbPath}`}
                            alt={result.game.fName}
                        />
                        <div style="flex: 1;">
                            <div class="game-name">{result.game.fName}</div>
                            <div class="game-description">
                                {result.game.description}
                            </div>
                            <div class="game-plays">
                                Plays: {result.game.clicks.toLocaleString() ??
                                    "0"}
                                {#if result.game.tags && result.game.tags.length}
                                    &nbsp;|&nbsp;
                                    <span>
                                        {#each result.game.tags as tag}
                                            <span
                                                style="background: #eee; border-radius: 4px; padding: 2px 6px; margin-right: 4px; font-size: 0.8em;"
                                                >{tag}</span
                                            >
                                        {/each}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>
<div class="main-content-wrapper">
    {#if adsEnabled && adSlots}
        <div class="sidebar-ad left-sidebar">
            <div class="xxx r">
                <Ad slotId={adSlots.sidebar} />
            </div>
        </div>
    {/if}
    <div class="container">
        <div class="sort-bar">
            <select id="sort-select" bind:value={sortType}>
                <option value="default">Recommended</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="clicksAsc">Clicks ↑</option>
                <option value="clicksDesc">Clicks ↓</option>
                <option value="new">Newest</option>
                <option value="old">Oldest</option>

            </select>
            <button
                class="choose-for-me"
                onclick={() => {
                    const sorted = getSortedGames();
                    if (sorted.length > 0) {
                        const randomGame =
                            sorted[Math.floor(Math.random() * sorted.length)];
                        openGame(randomGame);
                    }
                }}>Choose for me</button
            >
            <button
                class="search-button"
                onclick={() => toggleSearch()}
                title="Search"
                aria-label="Search"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="feather feather-search"
                    ><circle cx="11" cy="11" r="8"></circle><line
                        x1="21"
                        y1="21"
                        x2="16.65"
                        y2="16.65"
                    ></line></svg
                >
            </button>
        </div>
        <div class="card-grid {State.homeView}">
            {#if games.length === 0}
                {#each Array(12) as _, i}
                    <div class="load-shimmer">&nbsp;</div>
                {/each}
            {/if}
            {#each getSortedGames() as game, i (game.gameID)}
                <GameCard
                    {game}
                    {i}
                    {commitHash}
                    tagClick={(tag: string) => {
                        toggleSearch(decamelize(tag));
                    }}
                />
                {#if adsEnabled && adSlots && (i + 1) % 10 === 0}
                    <div class="inxxx agrid grid">
                        <Ad slotId={adSlots.grid} />
                    </div>
                {/if}
                {#if !adBlock && !adsEnabled}
                    {#if (i + 1) % 10 === 0}
                        <div class="inxxx agrid grid">
                            <div
                                style="text-align: center; font-size: 0.9rem; color: #555;width:100%;height:100%;display: flex;flex-direction: column;justify-content: center;align-items: center;"
                            >
                                <p>
                                    Contact <a
                                        href="mailto:ccported@ccported.click"
                                        >ccported@ccported.click</a
                                    > to advertise in this slot
                                </p>
                            </div>
                            <!-- <script
                                async
                                type="application/javascript"
                                src="https://a.magsrv.com/ad-provider.js"
                            ></script>
                            <ins
                                class="eas6a97888e2"
                                data-zoneid="5721174"
                                data-keywords="gaming,games,flash,retro,arcade,html,unblocked,video,fun,entertainment"
                            ></ins>
                            <script>
                                (AdProvider = window.AdProvider || []).push({
                                    serve: {},
                                });
                            </script> -->
                        </div>
                    {/if}
                {/if}
            {/each}
        </div>
    </div>
    {#if adsEnabled && adSlots}
        <div class="sidebar-ad right-sidebar">
            <div class="xxx r">
                <Ad slotId={adSlots.sidebar} />
            </div>
        </div>
    {/if}
</div>

<style>
    .load-shimmer {
        width: 90%;
        height: 280px;
        border-radius: 16px;
        border: 1px solid #e0e0e0;
        background: linear-gradient(
            90deg,
            #f0f0f0 0%,
            #e0e0e0 50%,
            #f0f0f0 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite linear;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
    .container {
        width: 100%;
        box-sizing: border-box;
    }
    .sort-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        box-sizing: border-box;
        justify-content: center;
        width: 100%;
        max-width: 1400px;
        margin-left: auto;
        margin-right: auto;
    }
    .sort-bar select {
        height: 40px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.5);
        border: none;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.05rem;
        color: #222;
        font-weight: 500;
        outline: none;
        min-width: 40px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        appearance: none;
        padding: 0 12px;
    }
    .sort-bar select:focus {
        background: rgba(255, 255, 255, 0.7);
        box-shadow:
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 4px 24px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
    }
    .choose-for-me {
        height: 40px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.5);
        border: none;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.05rem;
        color: #222;
        font-weight: 500;
        outline: none;
        min-width: 40px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0 12px;
    }
    .choose-for-me:hover,
    .choose-for-me:focus,
    .search-button:hover,
    .search-button:focus,
    .sort-bar select:focus,
    .sort-bar select:hover {
        background: rgba(255, 255, 255, 0.7);
        box-shadow:
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 4px 24px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
    }
    .search-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        border: none;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .search-overlay.visible {
        display: flex;
    }
    .search-overlay.hidden {
        display: none;
    }
    .search-overlay {
        width: 100vw;
        height: 100vh;
        position: fixed;
        top: 0;
        left: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 100;
    }
    .search {
        width: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        scrollbar-width: none;
    }
    .search .results-inner-container::-webkit-scrollbar {
        display: block;
        width: 8px;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .search .results-inner-container::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }
    .search .results-inner-container::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.5);
    }

    .results-inner-container {
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow-y: scroll;
        overflow-x: hidden;
        height: 33vh;
        padding: 0px;
        padding-right: 8px;
        padding-left: 8px;
    }
    .search ul {
        width: 100%;
        padding: 4px 12px 4px 12px;
        box-sizing: border-box;
        border-radius: 16px;
        margin: 0 auto;
        background-color: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px) saturate(180%);
        border: 1.5px solid #e0e0e0;
    }
    .search ul li.search-result-row {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        padding: 16px;
        box-sizing: border-box;
        cursor: pointer;
    }
    .search ul li.search-result-row:hover,
    .search ul li.search-result-row.selected {
        background: rgba(0, 0, 0, 0.05);
    }
    .search ul li.search-result-row img {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 12px;
        box-shadow:
            0 4px 16px rgba(0, 0, 0, 0.1),
            0 1px 8px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    li .game-name {
        font-weight: 600;
        font-size: 1.1rem;
        margin-bottom: 4px;
    }
    li .game-description {
        font-size: 0.95rem;
        color: #555;
        margin-bottom: 4px;
    }
    li .game-plays {
        font-size: 0.85rem;
        color: #888;
    }
    .search input#search {
        width: 80%;
        max-width: 600px;
        padding: 16px 24px;
        font-size: 1.2rem;
        border: none;
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.5);
        color: black;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        outline: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .search input#search:focus {
        background: rgba(255, 255, 255, 0.7);
        box-shadow:
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 4px 24px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
    }
    .card-grid {
        display: grid;
        padding: 20px;
        gap: 0;
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
        perspective: 1000px;
    }

    .card-grid.grid {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 0;
    }

    .card-grid.list {
        grid-template-columns: 1fr;
        gap: 0;
    }

    .card-grid.compact {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 0;
    }

    /* Responsive grid adjustments */
    @media (max-width: 1200px) {
        .card-grid.grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }
    }

    @media (max-width: 768px) {
        .card-grid {
            padding: 10px;
            box-sizing: border-box;
        }

        .card-grid.grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        }

        .card-grid.compact {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }
    }

    @media (max-width: 480px) {
        .card-grid.grid,
        .card-grid.compact {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 768px) {
        .search {
            width: 80%;
        }
        .sort-bar {
            flex-wrap: wrap;
        }
    }

    @media (max-width: 480px) {
        .search {
            width: 95%;
            gap: 8px;
        }
        .search input#search {
            width: 100%;
            padding: 12px 20px;
            font-size: 1rem;
        }
        .search ul {
            max-height: 40vh;
        }
        .search ul li.search-result-row {
            padding: 12px;
            gap: 12px;
        }
        .search ul li.search-result-row img {
            width: 48px;
            height: 48px;
            border-radius: 8px;
        }
        li .game-name {
            font-size: 1rem;
        }
        li .game-description {
            font-size: 0.85rem;
        }
        .sort-bar {
            gap: 8px;
            padding: 8px;
        }
        .sort-bar select,
        .choose-for-me {
            flex-grow: 1;
            font-size: 0.9rem;
            padding: 0 8px;
        }
    }

    /* Add staggered animation for card entrance */
    .card-grid :global(.card-wrapper) {
        animation: slideInUp 0.6s ease-out forwards;
        opacity: 0;
        transform: translateY(30px);
    }

    @keyframes slideInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .card-grid :global(.card-wrapper) {
            animation: none;
            opacity: 1;
            transform: none;
        }
    }

    .main-content-wrapper {
        display: flex;
        justify-content: center;
        width: 100%;
        gap: 20px;
    }
    .sidebar-ad {
        width: 300px;
        flex-shrink: 0;
        margin-top: 120px;
    }

    .inxxx.agrid.grid {
        padding: 20px;
        box-sizing: border-box;
        max-height: 300px;
    }
    .inxx.agrid.grid::before {
        content: "Ad Loading";
        display: block;
        text-align: center;
        color: #888;
        font-size: 0.9rem;
        margin-bottom: 8px;
        animation: fadeIn 0.5s ease-in-out;
    }

    @media (max-width: 1800px) {
        .sidebar-ad.right-sidebar {
            display: none;
        }
    }

    @media (max-width: 1400px) {
        .sidebar-ad {
            display: none;
        }
        .main-content-wrapper {
            justify-content: center;
        }
    }
</style>
