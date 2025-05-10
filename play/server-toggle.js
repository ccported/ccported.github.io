class ServerToggle {
    constructor(currentServer, switchCallback) {
        this.servers = [];
        this.currentServerIndex = 0;
        this.initialServerIndex = currentServer;
        this.uiVisible = false;
        this.uiElement = null;
        this.wheelElement = null;
        this.serverStatusCache = {};
        this.itemHeight = 60; // Height of each server item
        this.visibleItems = 5; // Number of visible items in the wheel
        this.switchCallback = switchCallback;

        this.init();
    }

    async init() {
        await this.loadServers();
        this.createUI();
        this.setupKeyboardListeners();
        for (var i = 0; i < this.initialServerIndex; i++) {
            this.nextServer(true);
        }
    }
    async getServerText() {
        try {
            const res = await fetch("/servers.txt");
            if (!res.ok) {
                return "Failed to load,error";
            }
            const text = await res.text();
            return text;
        } catch (e) {
            return "Failed to load,error"
        }
    }
    async loadServers() {
        const serversText = await this.getServerText();

        this.servers = serversText.split('\n').map((line, i) => {
            console.log(line.split(","));
            const [address, friendlyName, path] = line.split(',');
            return {
                address,
                friendlyName,
                index: i,
                path: path.trim(),
                isLive: null // Will be populated when checked
            };
        });

        // Check status of all servers initially
        await Promise.all(this.servers.map(server => this.checkServerStatus(server)));
    }

    async checkServerStatus(server) {
        try {
            const res = await fetch(`https://${server.address}/blocked_res.txt`);
            if (res.ok) {
                const text = await res.text();
                if (text.indexOf("===NOT_BLOCKED===") !== -1) {
                    server.isLive = true;
                } else {
                    server.isLive = false;
                }
            } else {
                server.isLive = false;
            }
            // Cache the result
            this.serverStatusCache[server.address] = {
                isLive: server.isLive,
                timestamp: Date.now()
            };

            // Update UI if it's visible
            if (this.uiVisible) {
                this.updateUI();
            }


            return server.isLive;
        } catch (error) {
            console.error(`Error checking server status for ${server.address}:`, error);
            server.isLive = false;
            return false;
        }
    }

    createUI() {
        // Create UI container
        this.uiElement = document.createElement('div');
        this.uiElement.className = 'server-toggle-wheel';
        document.body.appendChild(this.uiElement);

        const h2 = document.createElement("h2");
        h2.appendChild(document.createTextNode("Server Toggle"));
        this.uiElement.appendChild(h2);

        const instruction = document.createElement("p");
        instruction.innerHTML = "User CTRL + [ and ] to cylce between servers.";
        this.uiElement.appendChild(instruction);

        // Create wheel container
        const wheelContainer = document.createElement('div');
        wheelContainer.className = 'wheel-container';
        this.uiElement.appendChild(wheelContainer);


        // Create wheel element
        this.wheelElement = document.createElement('div');
        this.wheelElement.className = 'wheel';
        wheelContainer.appendChild(this.wheelElement);
    }

    updateUI() {
        if (!this.wheelElement) return;

        // Clear current wheel
        this.wheelElement.innerHTML = '';

        const totalServers = this.servers.length;

        // Create server items
        this.servers.forEach((server, index) => {
            const serverElement = document.createElement('div');
            serverElement.className = `server-item ${index === this.currentServerIndex ? 'selected' : ''}`;

            // Calculate position in the wheel
            const angleDelta = index - this.currentServerIndex;
            const angleInRadians = (angleDelta * Math.PI) / 8; // Adjust divisor for curvature

            // Calculate the Y position
            const y = angleDelta * this.itemHeight;

            // Calculate the Z translation and rotation based on the angle
            const z = 100 * Math.cos(angleInRadians);
            const rotationX = -angleInRadians * (180 / Math.PI); // Convert to degrees

            // Apply transforms
            serverElement.style.transform = `translateY(${y}px) translateZ(${z}px) rotateX(${rotationX}deg)`;
            serverElement.style.top = `calc(50% - ${this.itemHeight / 2}px)`;

            // Adjust opacity based on distance from center
            const opacity = Math.max(0.2, 1 - Math.abs(angleDelta) * 0.2);
            serverElement.style.opacity = opacity;

            // Server info container (name and address)
            const serverInfoContainer = document.createElement('div');
            serverInfoContainer.className = 'server-info-container';

            // Server name
            const nameElement = document.createElement('div');
            nameElement.className = 'server-name';
            nameElement.textContent = server.friendlyName;

            // Add name and address to the info container
            serverInfoContainer.appendChild(nameElement);

            // Status indicator
            const statusElement = document.createElement('div');
            statusElement.className = 'server-status';
            const statusColor = server.isLive
                ? '#4CAF50' // Green
                : '#F44336'; // Red
            serverInfoContainer.style.color = statusColor;
            // Append elements
            serverElement.appendChild(serverInfoContainer);


            this.wheelElement.appendChild(serverElement);
        });

        // Position the wheel
        this.updateWheelPosition();

        // Refresh all server statuses
        this.servers.forEach(server => {
            // Only refresh if the cached status is older than 30 seconds
            const cached = this.serverStatusCache[server.address];
            if (!cached || (Date.now() - cached.timestamp > 30000)) {
                this.checkServerStatus(server);
            }
        });
    }

    updateWheelPosition() {
        if (!this.wheelElement) return;

        // No need to set the transform here - each item has its own transform
        // based on its position relative to the current index
    }

    showUI() {
        if (!this.uiElement) return;

        this.uiVisible = true;
        this.uiElement.style.display = 'block';
        this.updateUI();
    }

    hideUI() {
        if (!this.uiElement) return;

        this.uiVisible = false;
        this.uiElement.style.display = 'none';
    }

    nextServer(hideUI = false) {
        this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
        if (!hideUI) this.showUI();
    }

    prevServer() {
        this.currentServerIndex = (this.currentServerIndex - 1 + this.servers.length) % this.servers.length;
        this.showUI();
    }

    setupKeyboardListeners() {
        // Track if Ctrl key is pressed
        let ctrlPressed = false;

        document.addEventListener('keydown', (event) => {
            // Check if Ctrl key is pressed
            if (event.key === 'Control') {
                ctrlPressed = true;
            }

            if (ctrlPressed) {
                if (event.key === ']') {
                    event.preventDefault();
                    this.nextServer();
                } else if (event.key === '[') {
                    event.preventDefault();
                    this.prevServer();
                }
            }
        });

        // Hide UI when Ctrl key is released
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Control') {
                ctrlPressed = false;
                this.hideUI();
                this.switchCallback(this.getCurrentServer())
            }
        });
    }

    getCurrentServer() {
        return this.servers[this.currentServerIndex];
    }

    static updateCurrentServerDisplay() {
        const currentServer = this.getCurrentServer();
        const currentServerInfoElement = document.getElementById('current-server-info');

        if (currentServerInfoElement && currentServer) {
            currentServerInfoElement.innerHTML = `
    <div><strong>Name:</strong> ${currentServer.friendlyName}</div>
    <div><strong>Address:</strong> ${currentServer.address}</div>
    <div class="status ${currentServer.isLive ? 'live' : 'offline'}">
      Status: ${currentServer.isLive ? '✓ Online' : '✗ Offline'}
    </div>
  `;
        }
    }
}