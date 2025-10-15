<script lang="ts">
    import { onMount } from "svelte";
    import { ScanCommand } from "@aws-sdk/client-dynamodb";
    import { initializeTooling, SessionState, State } from "$lib/state.js";
    import type { CNotification } from "$lib/types/notification.js";
    import { createModal } from "$lib/modal.js";
    import Navigation from "$lib/components/Navigation.svelte";

    let notifications: CNotification[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);
    let filter: 'all' | 'active' | 'expired' = $state('all');

    async function loadNotifications() {
        try {
            loading = true;
            error = null;

            if (!SessionState.dynamoDBClient || !SessionState.awsReady) {
                await initializeTooling();
            }

            const table = "ccported_notifs";
            const params = {
                TableName: table
            };

            const command = new ScanCommand(params);
            const data = await SessionState.dynamoDBClient?.send(command);

            if (data && data.Items) {
                notifications = data.Items.map(item => ({
                    notification_id: item.id?.S || "",
                    title: item.title?.S || "",
                    body: item.body?.S || "",
                    expires: parseInt(item.expires?.N || "0"),
                    ctaText: item.cta_text?.S,
                    ctaLink: item.cta_link?.S
                }));

                // Sort by expires descending (newest first)
                notifications.sort((a, b) => b.expires - a.expires);
            }
        } catch (err) {
            error = `Failed to load notifications: ${err instanceof Error ? err.message : 'Unknown error'}`;
        } finally {
            loading = false;
        }
    }

    function getFilteredNotifications() {
        const now = Date.now();
        return notifications.filter(notif => {
            if (filter === 'active') return notif.expires > now;
            if (filter === 'expired') return notif.expires <= now;
            return true; // 'all'
        });
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function isExpired(timestamp: number): boolean {
        return timestamp <= Date.now();
    }

    function viewNotification(notif: CNotification) {
        createModal({
            title: notif.title,
            content: notif.body,
            actions: [
                ...(notif.ctaText && notif.ctaLink
                    ? [{
                        label: notif.ctaText,
                        onClick: () => window.open(notif.ctaLink, "_blank")
                    }]
                    : []),
                { label: "Close", onClick: (modal) => modal.close() },
            ],
        });
    }

    function markAsSeen(notificationId: string) {
        if (!State.seenNotifications.includes(notificationId)) {
            State.seenNotifications.push(notificationId);
        }
    }

    onMount(() => {
        loadNotifications();
    });
</script>

<svelte:head>
    <title>Notifications - CCPorted</title>
    <meta name="description" content="View all notifications and announcements from CCPorted" />
</svelte:head>

<Navigation />

<main class="notifications-page">
    <div class="container">
        <div class="header">
            <h1>🔔 Notifications</h1>
            <p>Stay updated with the latest announcements and news from CCPorted</p>
        </div>

        <div class="controls">
            <div class="filter-tabs">
                <button 
                    class="tab" 
                    class:active={filter === 'all'}
                    onclick={() => filter = 'all'}
                >
                    All ({notifications.length})
                </button>
                <button 
                    class="tab" 
                    class:active={filter === 'active'}
                    onclick={() => filter = 'active'}
                >
                    Active ({notifications.filter(n => !isExpired(n.expires)).length})
                </button>
                <button 
                    class="tab" 
                    class:active={filter === 'expired'}
                    onclick={() => filter = 'expired'}
                >
                    Past ({notifications.filter(n => isExpired(n.expires)).length})
                </button>
            </div>
            <button class="refresh-btn" onclick={loadNotifications}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                Refresh
            </button>
        </div>

        {#if loading}
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading notifications...</p>
            </div>
        {:else if error}
            <div class="error">
                <h3>⚠️ Error Loading Notifications</h3>
                <p>{error}</p>
                <button onclick={loadNotifications}>Try Again</button>
            </div>
        {:else}
            <div class="notifications-list">
                {#each getFilteredNotifications() as notif (notif.notification_id)}
                    {@const expired = isExpired(notif.expires)}
                    {@const seen = State.seenNotifications.includes(notif.notification_id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        class="notification-card" 
                        class:expired 
                        class:unseen={!seen}
                        onclick={() => {
                            viewNotification(notif);
                            markAsSeen(notif.notification_id);
                        }}
                    >
                        <div class="notification-header">
                            <h3>{notif.title}</h3>
                            <div class="notification-meta">
                                <span class="status" class:expired>
                                    {expired ? '📋 Past' : '🔴 Active'}
                                </span>
                                {#if !seen && !expired}
                                    <span class="new-badge">NEW</span>
                                {/if}
                            </div>
                        </div>
                        
                        <div class="notification-body">
                            <p>{@html notif.body}</p>
                        </div>
                        
                        <div class="notification-footer">
                            <div class="expires">
                                {expired ? 'Expired' : 'Expires'}: {formatDate(notif.expires)}
                            </div>
                            {#if notif.ctaText && notif.ctaLink}
                                <div class="cta-info">
                                    <span class="cta-label">Action: {notif.ctaText}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}

                {#if getFilteredNotifications().length === 0}
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h3>No notifications found</h3>
                        <p>
                            {#if filter === 'active'}
                                There are no active notifications at the moment.
                            {:else if filter === 'expired'}
                                No past notifications to display.
                            {:else}
                                No notifications available.
                            {/if}
                        </p>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</main>

<style>
    .notifications-page {
        min-height: 100vh;
        padding: 2rem 0;
    }

    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 0 1rem;
    }

    .header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .header h1 {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1a202c;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .header p {
        font-size: 1.1rem;
        color: #4a5568;
        margin: 0;
    }

    .controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .filter-tabs {
        display: flex;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 12px;
        padding: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(10px);
    }

    .tab {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #4a5568;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tab:hover {
        background: rgba(30, 144, 255, 0.1);
        color: var(--theme-blue);
    }

    .tab.active {
        background: var(--theme-blue);
        color: white;
        box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
    }

    .refresh-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 8px;
        color: #4a5568;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
    }

    .refresh-btn:hover {
        background: rgba(255, 255, 255, 0.95);
        border-color: var(--theme-blue);
        color: var(--theme-blue);
        transform: translateY(-1px);
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        text-align: center;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(30, 144, 255, 0.2);
        border-top: 3px solid var(--theme-blue);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .error {
        background: rgba(254, 226, 226, 0.8);
        border: 1px solid rgba(252, 165, 165, 0.8);
        border-radius: 12px;
        padding: 2rem;
        text-align: center;
        backdrop-filter: blur(10px);
    }

    .error h3 {
        color: #dc2626;
        margin: 0 0 1rem 0;
    }

    .error p {
        color: #7f1d1d;
        margin: 0 0 1rem 0;
    }

    .error button {
        background: #dc2626;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }

    .notifications-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .notification-card {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        backdrop-filter: blur(10px);
    }

    .notification-card:hover {
        background: rgba(255, 255, 255, 0.95);
        border-color: var(--theme-blue);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .notification-card.expired {
        opacity: 0.7;
        border-color: rgba(156, 163, 175, 0.5);
    }

    .notification-card.unseen {
        border-left: 4px solid var(--theme-blue);
        background: rgba(30, 144, 255, 0.02);
    }

    .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .notification-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #1a202c;
        flex: 1;
    }

    .notification-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .status {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        background: rgba(16, 185, 129, 0.1);
        color: #047857;
    }

    .status.expired {
        background: rgba(156, 163, 175, 0.2);
        color: #374151;
    }

    .new-badge {
        background: var(--theme-blue);
        color: white;
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 0.65rem;
        font-weight: 600;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .notification-body p {
        margin: 0;
        color: #4a5568;
        line-height: 1.6;
    }

    .notification-footer {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(226, 232, 240, 0.6);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .expires {
        font-size: 0.85rem;
        color: #6b7280;
    }

    .cta-info {
        font-size: 0.85rem;
    }

    .cta-label {
        color: var(--theme-blue);
        font-weight: 500;
    }

    .empty-state {
        text-align: center;
        padding: 3rem;
        color: #6b7280;
    }

    .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .empty-state h3 {
        margin: 0 0 0.5rem 0;
        color: #374151;
    }

    .empty-state p {
        margin: 0;
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .notifications-page {
            padding: 1rem 0;
        }

        .header h1 {
            font-size: 2rem;
        }

        .controls {
            flex-direction: column;
            align-items: stretch;
        }

        .filter-tabs {
            justify-content: center;
        }

        .notification-card {
            padding: 1rem;
        }

        .notification-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .notification-footer {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
