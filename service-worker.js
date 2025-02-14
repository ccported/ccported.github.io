// service-worker.js
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', async (event) => {
    const clientId = event.clientId;
    const requestId = Math.random().toString(16).slice(2);
    const clone = event.request.clone();
    // Create headers object from request headers
    const headers = {};
    for (const [key, value] of clone.headers.entries()) {
        headers[key] = value;
    }

    // Send initial request details to all clients
    const requestDetails = {
        type: 'request-start',
        id: requestId,
        url: clone.url,
        method: clone.method,
        headers: headers,
        timestamp: Date.now()
    };

    self.clients.get(clientId).then(client => {
        if(!client) {
            return;
        }
        client.postMessage(requestDetails);
    });
    event.respondWith(
        fetch(event.request)
            .then(async response => {
                try {
                    // Clone the response to read headers and body
                    const responseClone = response.clone();

                    // Create headers object from response headers
                    const responseHeaders = {};
                    for (const [key, value] of response.headers.entries()) {
                        responseHeaders[key] = value;
                    }

                    // Get content type
                    const contentType = response.headers.get('content-type') || '';

                    // Handle different content types
                    let responseData;
                    let responseFormat;

                    if (contentType.includes('image/')) {
                        // For images, convert to base64
                        const blob = await responseClone.blob();
                        responseData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        responseFormat = 'image';
                    } else if (contentType.includes('application/json')) {
                        // For JSON, parse it
                        responseData = await responseClone.text();
                        try {
                            // Verify it's valid JSON by parsing and stringifying
                            JSON.parse(responseData);
                            responseFormat = 'json';
                        } catch (e) {
                            responseFormat = 'text';
                        }
                    } else {
                        // Default to text
                        responseData = await responseClone.text();
                        responseFormat = 'text';
                    }
                    const parsedBody = await parseBodyStream(clone.body);
                    // Send response details to all clients
                    const responseDetails = {
                        type: 'request-complete',
                        id: requestId,
                        url: clone.url,
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                        timestamp: Date.now(),
                        response: responseData,
                        responseFormat: responseFormat,
                        method: clone.method
                    };
                    // if the response length is greater than 1kb, truncate it
                    if(responseDetails.response.length > 1000 && responseDetails.responseFormat !== 'image') {
                        responseDetails.response = responseDetails.response.substring(0, 1000) + '...';
                    }

                    if (parsedBody[0]) {
                        console.log(parsedBody)
                        responseDetails.body = parsedBody[0];
                        responseDetails.bodyType = parsedBody[1];
                    }

                    self.clients.get(clientId).then(client => {
                        if(!client) {
                            return;
                        }
                        client.postMessage(responseDetails);
                    });

                    return response;
                } catch (e) {
                    console.log(e);
                    const errorDetails = {
                        type: 'request-error',
                        id: requestId,
                        url: event.request.url,
                        error: e.message,
                        timestamp: Date.now()
                    };
                    self.clients.get(clientId).then(client => {
                        client.postMessage(errorDetails);
                    });
                    throw e;
                }
            })
            .catch(error => {
                // Send error details to all clients
                const errorDetails = {
                    type: 'request-error',
                    id: requestId,
                    url: event.request.url,
                    error: error.message,
                    timestamp: Date.now()
                };

                self.clients.get(clientId).then(client => {
                    client.postMessage(errorDetails);
                });

                throw error;
            })
    );
});


async function parseBodyStream(body, contentType) {
    if (!body) {
        return [null, 'text/plain'];
    }

    // Handle null or undefined content type
    contentType = contentType?.toLowerCase() || '';

    try {
        // Convert ReadableStream to ArrayBuffer
        const arrayBuffer = await new Response(body).arrayBuffer();

        // Handle different content types
        if (contentType.includes('application/json')) {
            const text = new TextDecoder().decode(arrayBuffer);
            return [JSON.parse(text), 'application/json'];
        }

        if (contentType.includes('text/html') ||
            contentType.includes('text/plain') ||
            contentType.includes('text/css') ||
            contentType.includes('application/javascript')) {
            return [new TextDecoder().decode(arrayBuffer), 'text/plain'];
        }

        if (contentType.includes('image/')) {
            return [new Blob([arrayBuffer], { type: contentType }), contentType];
        }

        if (contentType.includes('application/pdf')) {
            return [new Blob([arrayBuffer], { type: 'application/pdf' }), contentType];
        }

        if (contentType.includes('multipart/form-data')) {
            // Handle form data
            const formData = new FormData();
            const text = new TextDecoder().decode(arrayBuffer);
            const boundary = contentType.split('boundary=')[1];
            const parts = text.split(new RegExp(`--${boundary}[\\r\\n]*`));

            for (const part of parts) {
                if (!part || part === '--') continue;

                const [headers, ...bodyParts] = part.split('\r\n\r\n');
                const body = bodyParts.join('\r\n\r\n');

                const nameMatch = headers.match(/name="([^"]+)"/);
                if (nameMatch) {
                    const name = nameMatch[1];
                    formData.append(name, body.trim());
                }
            }

            return [formData, 'multipart/form-data'];
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = new TextDecoder().decode(arrayBuffer);
            const params = new URLSearchParams(text);
            const result = {};
            for (const [key, value] of params) {
                result[key] = value;
            }
            return [result, 'application/x-www-form-urlencoded'];
        }

        if (contentType.includes('application/xml') ||
            contentType.includes('text/xml')) {
            const text = new TextDecoder().decode(arrayBuffer);
            const parser = new DOMParser();
            return [parser.parseFromString(text, 'text/xml'), 'text/plain'];
        }

        // Default: return raw text for unknown types
        return [new TextDecoder().decode(arrayBuffer), "text/plain"];
    } catch (error) {
        throw new Error(`Failed to parse body stream: ${error.message}`);
    }
}
