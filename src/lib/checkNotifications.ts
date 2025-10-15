import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { initializeTooling, SessionState, State } from "./state.js";
import type { CNotification } from "./types/notification.js";
import { createModal } from "./modal.js"; // Assume you have a modal utility

export async function checkNotifications() {

    const table = "push_notifications";

    const now = Date.now();

    const documentClient = SessionState.dynamoDBClient;

    if (!documentClient || !SessionState.awsReady) {
        await initializeTooling();
    }



    const params = {
        TableName: table,
        FilterExpression: "expires > :now",
        ExpressionAttributeValues: {
            ":now": { N: now.toString() }
        }
    };

    const command = new ScanCommand(params);
    const data = await documentClient?.send(command);

    if (data && data.Items && data.Items.length > 0) {
        const notifications = data.Items.map(item => {
            return {
                notification_id: item.id?.S || "",
                title: item.title?.S || "",
                body: item.body?.S || "",
                expires: parseInt(item.expires?.N || "0"),
                ctaText: item.cta_text?.S,
                ctaLink: item.cta_link?.S
            };
        });

        // Sort by expires ascending
        notifications.sort((a, b) => a.expires - b.expires);

        handleNotifs(notifications);
    }


}

function handleNotifs(notifications: CNotification[]) {
    notifications.forEach(notif => {
        if (State.seenNotifications.includes(notif.notification_id)) {
            return; // Already seen
        }
        State.seenNotifications.push(notif.notification_id);
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
    });
}