export interface CNotification {
    notification_id: string;
    expires: number;
    title: string;
    body: string;
    ctaText?: string;
    ctaLink?: string;
}