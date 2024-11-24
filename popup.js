document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById("slider");
    const decreaseBtn = document.getElementById("decrease");
    const increaseBtn = document.getElementById("increase");
    const resetBtn = document.getElementById("reset");
    const resizeContainerCheckbox = document.getElementById("resize-container");
    const ignoreSvgCheckbox = document.getElementById("ignore-svg");

    // Debounce function to limit the rate of function calls
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Get the current tab's hostname
    function getCurrentHostname(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    callback(url.hostname);
                } catch (e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    }

    // Load saved settings for the current hostname
    function loadSettings(hostname) {
        if (!hostname) return;
        chrome.storage.local.get([hostname], (result) => {
            if (result[hostname]) {
                const { scale, forceResize, ignoreSvg } = result[hostname];
                if (scale) slider.value = scale;
                if (typeof forceResize !== 'undefined') {
                    resizeContainerCheckbox.checked = forceResize;
                }
                if (typeof ignoreSvg !== 'undefined') {
                    ignoreSvgCheckbox.checked = ignoreSvg;
                }
            } else {
                // If no settings saved, set defaults
                slider.value = 100;
                resizeContainerCheckbox.checked = true;
                ignoreSvgCheckbox.checked = true;
            }
        });
    }

    // Save settings for the current hostname
    function saveSettings(hostname, scale, forceResize, ignoreSvg) {
        if (!hostname) return;
        const data = {
            [hostname]: {
                scale,
                forceResize,
                ignoreSvg
            }
        };
        chrome.storage.local.set(data);
    }

    // Send message to content script
    function sendMessage(action, data) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action, data });
            }
        });
    }

    // Function to show notifications
    function showNotification(title, message) {
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: title,
                message: message
            }, (notificationId) => {
                if (chrome.runtime.lastError) {
                    console.error('Notification error:', chrome.runtime.lastError);
                }
            });
        } else {
            console.warn('Notifications API not available.');
        }
    }

    // Update resizing
    function updateResize(hostname) {
        const scale = parseInt(slider.value);
        const forceResize = resizeContainerCheckbox.checked;
        const ignoreSvg = ignoreSvgCheckbox.checked;

        // Save settings
        saveSettings(hostname, scale, forceResize, ignoreSvg);

        // Send resize message
        sendMessage('resize', { scale, forceResize, ignoreSvg });
    }

    // Debounced save function
    const debouncedUpdateResize = debounce((hostname) => updateResize(hostname), 300);

    // Initialize settings on popup load
    getCurrentHostname((hostname) => {
        loadSettings(hostname);

        // Attach event listeners after settings are loaded
        slider.addEventListener("input", () => {
            debouncedUpdateResize(hostname);
        });

        decreaseBtn.addEventListener("click", () => {
            slider.value = Math.max(50, parseInt(slider.value) - 10);
            debouncedUpdateResize(hostname);
        });

        increaseBtn.addEventListener("click", () => {
            slider.value = Math.min(300, parseInt(slider.value) + 10);
            debouncedUpdateResize(hostname);
        });

        resetBtn.addEventListener("click", () => {
            // Reset slider and checkboxes to default
            slider.value = 100;
            resizeContainerCheckbox.checked = true;
            ignoreSvgCheckbox.checked = true;

            // Save reset settings
            saveSettings(hostname, 100, true, true);

            // Send reset message
            sendMessage('reset', { forceResize: true, ignoreSvg: true });

            // Show notification
            showNotification('Image Resizer', 'Images have been reset to original sizes for this website.');
        });
    });
});
