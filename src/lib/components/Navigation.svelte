<script lang="ts">
    import { page } from "$app/state";
    let links = [
        ["Notifications", "/notifications"],
        ["Tab Cloaker", "/tab-cloaker"],
        [
            "Master Doc",
            "https://docs.google.com/document/d/11yw7n2F84XOkAwpM8tF-ZYHESuus1Gg7dmJ-WJum1fk",
        ],
        ["ROM Library", "/roms"],
        ["Discord", "https://discord.gg/GDEFRBTT3Z"],
    ];

    // Use dirty URLs if hosted on amazonaws
    if (typeof window !== "undefined" && window.origin.includes("amazonaws")) {
        links = [
            ["Tab Cloaker", "/tab-cloaker.html"],
            [
                "Master Doc",
                "https://docs.google.com/document/d/11yw7n2F84XOkAwpM8tF-ZYHESuus1Gg7dmJ-WJum1fk",
            ],
            ["ROM Library", "/roms.html"],
            ["Discord", "https://discord.gg/GDEFRBTT3Z"],
        ];
    }

    const currentPath = page.url.pathname;
    let menuOpen = $state(false);
</script>

<div class="n-container">
    <nav>
        <ul class="left">
            <li><a href="/">CCPorted</a></li>
        </ul>
        <ul class="right desktop-links">
            {#each links as [name, url]}
                <li class:active={currentPath === url}>
                    <a
                        href={url}
                        target={url.startsWith("http") ? "_blank" : "_self"}
                        rel={url.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined}
                    >
                        {name}
                    </a>
                </li>
            {/each}
        </ul>
        <button class="mobile-menu-button" onclick={() => menuOpen = !menuOpen} aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        </button>
    </nav>
</div>

{#if menuOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mobile-menu-overlay" onclick={() => menuOpen = false}>
        <div class="mobile-menu" onclick={(e) => e.stopPropagation()}>
            <button class="close-button" onclick={() => menuOpen = false} aria-label="Close menu">&times;</button>
            <ul>
                {#each links as [name, url]}
                    <li class:active={currentPath === url}>
                        <a
                            href={url}
                            target={url.startsWith("http") ? "_blank" : "_self"}
                            rel={url.startsWith("http")
                                ? "noopener noreferrer"
                                : undefined}
                            onclick={() => menuOpen = false}
                        >
                            {name}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
{/if}

<div class="spacer"></div>

<style>
    div.n-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: fixed;
        top: 20px;
        z-index: 1000;
        padding: 0 16px;
        box-sizing: border-box;
    }
    .spacer {
        height: calc(20px + 60px);
        margin-bottom: 20px;
        flex-shrink: 0;
        width: 100%;
    }
    nav {
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.12);
        height: 60px;
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 32px;
        border-radius: 24px;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        width: 100%;
        max-width: 1400px;
    }

    nav:hover {
        background: rgba(255, 255, 255, 0.6);
        border-color: rgba(255, 255, 255, 0.18);
        box-shadow:
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 4px 24px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
    }

    ul {
        list-style: none;
        display: flex;
        margin: 0;
        padding: 0;
        gap: 8px;
    }

    ul.left li {
        margin-right: 24px;
    }

    a {
        color: rgba(0, 0, 0, 0.8);
        text-decoration: none;
        font-weight: 600;
        font-size: 0.95rem;
        letter-spacing: 0.02em;
        padding: 10px 18px;
        border-radius: 14px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid transparent;
        position: relative;
        overflow: hidden;
    }

    /* Subtle shine effect */
    a::before {
        content: "";
        position: relative;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
        );
        transition: left 0.6s ease;
        z-index: -1;
    }

    a:hover::before {
        left: 50%;
    }

    a:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(0, 0, 0, 0.9);
        box-shadow:
            0 4px 20px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
    }

    .active a {
        background: rgba(140, 140, 140, 0.15);
        border-color: rgba(94, 94, 94, 0.3);
        font-weight: 700;
        box-shadow:
            0 4px 20px rgba(112, 112, 112, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .active a:hover {
        background: rgba(180, 180, 180, 0.2);
        border-color: rgba(115, 115, 115, 0.4);
    }

    /* Logo styling */
    ul.left a {
        font-weight: 800;
        font-size: 1.1rem;
    }

    .mobile-menu-button {
        display: none;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        transition: background 0.2s;
    }
    .mobile-menu-button:hover {
        background: rgba(0,0,0,0.1);
    }

    .mobile-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.5);
        z-index: 1001;
        display: flex;
        justify-content: flex-end;
    }
    .mobile-menu {
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        width: 80%;
        max-width: 300px;
        height: 100%;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }

    .mobile-menu .close-button {
        background: none;
        border: none;
        font-size: 2rem;
        color: #333;
        cursor: pointer;
        align-self: flex-end;
        padding: 0;
        margin-bottom: 24px;
    }

    .mobile-menu ul {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }
    .mobile-menu ul li {
        width: 100%;
    }
    .mobile-menu a {
        font-size: 1.1rem;
        display: block;
        padding: 12px 16px;
    }

    @media (max-width: 768px) {
        nav {
            width: 100%;
            margin: 0;
            padding: 12px 20px;
            border-radius: 24px;
            top: 0;
        }
        div.n-container {
            top: 12px;
        }

        ul.right.desktop-links {
            display: none;
        }
        .mobile-menu-button {
            display: block;
        }

        ul {
            gap: 4px;
        }

        ul.left li {
            margin-right: 12px;
        }

        a {
            font-size: 0.85rem;
            padding: 8px 14px;
            border-radius: 12px;
        }

        ul.left a {
            font-size: 0.95rem;
        }
    }

    @media (max-width: 480px) {
        nav {
            flex-direction: row; /* Revert from column */
            justify-content: space-between;
            gap: 0;
            padding: 12px 20px;
        }

        ul.left li {
            margin-right: 0;
        }

        ul {
            justify-content: flex-start;
            flex-wrap: nowrap;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        nav,
        a,
        a::before,
        .mobile-menu {
            transition: none;
            animation: none;
        }

        nav:hover {
            transform: none;
        }

        a:hover {
            transform: none;
        }
    }
</style>
