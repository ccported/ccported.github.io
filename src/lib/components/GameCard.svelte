<script lang="ts">
    import { decamelize, formatNumber, openGame } from "$lib/helpers.js";
    import { State } from "$lib/state.js";
    import { browser } from "$app/environment";

    import type { Game } from "../types/game.ts";

    const {
        game,
        i,
        tagClick,
        commitHash,
    }: {
        game: Game;
        i: number;
        tagClick: (tag: string) => void;
        commitHash: string;
    } = $props();
    const {
        gameID,
        thumbPath,
        fName,
        description,
        tags,
        clicks,
        uploadedTimestamp,
        updatedTimestamp,
    } = game;

    let normalThumbPath = `https://cdn.jsdelivr.net/gh/ccported/games@${commitHash}/${gameID}${thumbPath}`;
    let starred = $state(State.pinnedGames.includes(gameID) ? true : false);

    let cardElement: HTMLDivElement;
    let isHovered = $state(false);

    function togglePin(e: MouseEvent | KeyboardEvent) {
        e.stopPropagation();
        if (State.pinnedGames.includes(gameID)) {
            starred = false;
            State.pinnedGames = State.pinnedGames.filter((id) => id !== gameID);
        } else {
            starred = true;
            State.pinnedGames = [gameID, ...State.pinnedGames];
        }
    }

    let isUpdated =
        Date.now() - updatedTimestamp < 604800000 &&
        updatedTimestamp &&
        updatedTimestamp > 0; // 7 days in milliseconds
    let isNew =
        Date.now() - uploadedTimestamp < 604800000 &&
        uploadedTimestamp &&
        uploadedTimestamp > 0; // 7 days in milliseconds

    let show: "" | " (Updated)" | " (New)" =
        isUpdated && !isNew ? " (Updated)" : isNew ? " (New)" : "";

    function handleMouseMove(e: MouseEvent) {
        if (!cardElement) return;

        const rect = cardElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -15;
        const rotateY = ((x - centerX) / centerX) * 15;

        cardElement.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
    }

    function handleMouseEnter() {
        isHovered = true;
        if (cardElement) {
            cardElement.style.transition = "transform 0.1s ease-out";
        }
    }

    function handleMouseLeave() {
        isHovered = false;
        if (cardElement) {
            cardElement.style.transition =
                "transform 0.6s cubic-bezier(0.23, 1, 0.320, 1)";
            cardElement.style.transform =
                "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
        }
    }
</script>

<div
    class="card-wrapper"
    style="position: relative; animation-delay: {i < 25 ? i * 75 : 75 * 25}ms"
    class:new={isNew || isUpdated}
    class:starred
>
    <button
        type="button"
        class="star-icon"
        aria-label="Pin game"
        class:starred
        onclick={togglePin}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") togglePin(e);
        }}
        tabindex="0">★</button
    >
    <div
        bind:this={cardElement}
        class="card {State.homeView}"
        class:hovered={isHovered}
        id={gameID}
        aria-label="Open game"
        onclick={() => {
            // navigator.clipboard.writeText(gameID);
            openGame(game);
        }}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") openGame(game);
        }}
        onmousemove={handleMouseMove}
        onmouseenter={handleMouseEnter}
        onmouseleave={handleMouseLeave}
        tabindex="-1"
        role="link"
    >
        <div
            class="card-bg"
            style="background-image: url({normalThumbPath})"
        ></div>
        <div class="card-shine"></div>
        <div class="card-content">
            <div class="content-inner">
                <h2 class="card-title">{fName}{show}</h2>
                <p class="small-text">{formatNumber(clicks) ?? 0} Plays</p>
                <p class="card-description">{description}</p>
                <div class="card-tags">
                    {#each tags as tag}
                        <button
                            class="tag"
                            data-tag={tag}
                            onclick={(e) => {
                                e.stopPropagation();
                                tagClick(tag as string);
                            }}>{decamelize(tag as string)}</button
                        >
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .card-wrapper {
        position: relative;
        margin: 16px;
        perspective: 1000px;
    }
    .card-wrapper.new {
        border-radius: 20px;
        box-shadow: 0px 0px 15px 10px rgba(255, 215, 0, 0.5);
        background-color: rgba(255, 215, 0, 0.5);
    }
    .card-wrapper.starred {
        order: -1;
    }
    .card {
        position: relative;
        width: 100%;
        height: 300px;
        background: linear-gradient(
            135deg,
            var(--theme-blue) 0%,
            var(--theme-dark-blue) 100%
        );
        border-radius: 20px;
        overflow: hidden;
        cursor: pointer;
        border: none;
        padding: 0;
        box-shadow:
            0 4px 15px 0 rgba(31, 38, 135, 0.37),
            0 8px 32px 0 rgba(31, 38, 135, 0.37);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        transform-style: preserve-3d;
    }
    .card:hover {
        box-shadow:
            0 8px 30px 0 rgba(31, 38, 135, 0.5),
            0 16px 64px 0 rgba(31, 38, 135, 0.3);
    }
    .small-text {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 4px 0 8px 0;
    }
    .card.hovered {
        z-index: 10;
    }

    .card-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        transform: translateZ(10px);
    }

    .card:hover .card-bg {
        transform: translateZ(30px) scale(1.1);
    }

    .card-shine {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 70%
        );
        transform: translateX(-100%);
        transition: transform 0.6s;
        pointer-events: none;
    }

    .card:hover .card-shine {
        transform: translateX(100%);
    }

    .card-content {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.7);
        transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        transform: translateZ(20px);
    }

    .card:hover .card-content {
        transform: translateZ(40px);
        background: rgba(0, 0, 0, 0.43);
    }

    .content-inner {
        transform: translateZ(10px);
    }

    .card-title {
        color: white;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 8px 0;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .card:hover .card-title {
        transform: translateZ(20px);
    }

    .card-description {
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.9rem;
        line-height: 1.4;
        margin: 0 0 12px 0;
        display: -webkit-box;
        line-clamp: 3;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .card:hover .card-description {
        transform: translateZ(15px);
    }

    .card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .card:hover .card-tags {
        transform: translateZ(25px);
    }

    .tag {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid rgba(255, 255, 255, 0.3);
        transition: all 0.3s ease;
        text-transform: capitalize;
    }

    .tag:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
    }

    .star-icon {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 20;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        color: rgba(255, 255, 255, 0.8);
        transition: all 0.3s ease;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    }

    .star-icon:hover {
        background: rgba(0, 0, 0, 0.6);
        border-color: rgba(255, 215, 0, 0.5);
        color: #ffd700;
        transform: scale(1.1);
    }

    .star-icon.starred {
        background: rgba(0, 0, 0, 0.6);
        border-color: rgba(255, 215, 0, 0.5);
        color: #ffd700;
        transform: scale(1.1);
    }

    /* Grid view specific styles */
    .card.grid {
        height: 280px;
    }

    .card.list {
        height: 140px;
        display: flex;
        flex-direction: row;
    }

    .card.list .card-bg {
        width: 40%;
        height: 100%;
    }

    .card.list .card-content {
        width: 60%;
        height: 100%;
        position: relative;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .card-wrapper {
            margin: 8px;
        }

        .card {
            height: 250px;
        }

        .card-title {
            font-size: 1.25rem;
        }

        .card-description {
            font-size: 0.8rem;
        }
    }

    @media (max-width: 480px) {
        .card-wrapper {
            margin: 8px 0;
        }
        .card {
            height: 220px;
        }
        .card-title {
            font-size: 1.1rem;
        }
        .card-description {
            font-size: 0.75rem;
            line-clamp: 2;
            -webkit-line-clamp: 2;
        }
        .tag {
            font-size: 0.7rem;
            padding: 3px 8px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .card,
        .card-bg,
        .card-content,
        .card-title,
        .card-description,
        .card-tags,
        .star-icon {
            transition: none;
        }
    }
</style>
