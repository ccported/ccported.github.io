export interface ModalAction {
    label: string;
    onClick: (modalApi: { close: () => void }) => void;
}

export interface ModalOptions {
    title: string;
    content: string;
    actions: ModalAction[];
}
export function createModal(options: ModalOptions): { close: () => void } {
    // Create the overlay
    const overlay = document.createElement("div");
    overlay.classList.add("modal-overlay");
    
    // Create the modal
    const modal = document.createElement("div");
    modal.classList.add("modal");

    const title = document.createElement("h2");
    title.textContent = options.title;
    modal.appendChild(title);

    const content = document.createElement("p");
    // Use innerHTML to allow HTML content
    content.innerHTML = options.content;
    modal.appendChild(content);

    const actionsContainer = document.createElement("div");
    actionsContainer.classList.add("modal-actions");
    options.actions.forEach((action, index) => {
        const button = document.createElement("button");
        button.textContent = action.label;
        // Add primary class to first button, secondary to others
        button.classList.add(index === 0 ? "primary" : "secondary");
        button.onclick = () => action.onClick(modalApi);
        actionsContainer.appendChild(button);
    });
    modal.appendChild(actionsContainer);

    // Append modal to overlay, then overlay to body
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close modal when clicking overlay (but not the modal itself)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            modalApi.close();
        }
    });

    // Close modal on Escape key
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            modalApi.close();
        }
    };
    document.addEventListener('keydown', handleEscape);

    const modalApi = {
        close: () => {
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
        }
    };

    return modalApi;
}
