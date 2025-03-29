(function () {
    // Create the enabledEl element
    var enabledEl = document.createElement('div');
    enabledEl.classList.add('adb-enabled');
    enabledEl.innerHTML = `
        <div class="adb-enabled-overlay">
            <div class="adb-enabled-content">
                <h2>Ad blocker detected</h2>
                <p>Please disable your AdBlock to continue.</p>
                <button class="adb-continue-btn">Continue without supporting -></button>
            </div>
        </div>
    `;
    enabledEl.style.display = "none";
    // Add the element to the body
    document.body.appendChild(enabledEl);

    // Adblock detection logic
    function adBlockDetected() {
        enabledEl.style.display = 'block';

        // Adblock delay countdown
        var countdownEl = enabledEl.querySelector('.adb-continue-btn');
        var countdown = 10;
        var countdownInterval = setInterval(function () {
            countdown--;
            countdownEl.textContent = `Continue without supporting (${countdown}s) ->`;
            if (countdown === 0) {
                clearInterval(countdownInterval);
                countdownEl.textContent = 'Continue without supporting ->';
            }
        }, 1000);

        // Check if the element still exists every 750ms
        var checkInterval = setInterval(function () {
            if (!document.body.contains(enabledEl)) {
                clearInterval(checkInterval);
                createEnabldeEl();
            }
        }, 750);
    }

    function adBlockNotDetected() {
        enabledEl.style.display = 'none';
    }

    function createEnabldeEl() {
        // Recreate the enabledEl element
        enabledEl = document.createElement('div');
        enabledEl.classList.add('adb-enabled');
        enabledEl.innerHTML = `
            <div class="adb-enabled-overlay">
                <div class="adb-enabled-content">
                    <h2>Ad blocker detected</h2>
                    <p>Please disable your AdBlock to continue.</p>
                    <button class="adb-continue-btn">Continue without supporting (10s) -></button>
                </div>
            </div>
        `;
        document.body.appendChild(enabledEl);
    }

    if (typeof window.adblockDetector === 'undefined') {
        adBlockDetected();
    } else {
        window.adblockDetector.init(
            {
                debug: true,
                found: function () {
                    adBlockDetected();
                },
                notFound: function () {
                    adBlockNotDetected();
                }
            }
        );
    }
})();