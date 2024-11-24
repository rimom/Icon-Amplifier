// Utility function to determine if an image is an SVG
function isSvgImage(img) {
    if (img.tagName.toLowerCase() !== "img") return false;

    const src = img.getAttribute("src") || "";
    // Check if src starts with data:image/svg+xml (inline SVG) - Shopify
    if (src.startsWith("data:image/svg+xml")) return true;

    // Check if src ends with .svg (external SVG)
    try {
        const url = new URL(src, window.location.href);
        return url.pathname.toLowerCase().endsWith(".svg");
    } catch (e) {
        return false;
    }
}

// Function to resize images and SVGs
function resizeImages(scale, forceResizeContainers, ignoreSvg) {
    const elements = document.querySelectorAll("img, svg");

    elements.forEach((el) => {
        const isInlineSvg = el.tagName.toLowerCase() === "img" && el.src.startsWith("data:image/svg+xml");
        const isExternalSvg = isSvgImage(el) && !isInlineSvg;

        // Skip SVG elements if "Ignore SVG" is checked
        if (ignoreSvg && (el.tagName.toLowerCase() === "svg" || isInlineSvg || isExternalSvg)) return;

        // Function to store original dimensions if not already stored
        const storeOriginalDimensions = (element) => {
            if (!element.dataset.originalWidth) {
                const computedStyle = window.getComputedStyle(element);
                element.dataset.originalWidth = computedStyle.width;
                element.dataset.originalHeight = computedStyle.height;
            }
        };

        // Function to resize the element
        const applyResize = (element, newWidth, newHeight) => {
            element.style.width = newWidth;
            element.style.height = newHeight;
        };

        // Handle standard <img> elements
        if (el.tagName.toLowerCase() === "img" && !isInlineSvg && !isExternalSvg) {
            storeOriginalDimensions(el);

            // Calculate new width based on scale
            const originalWidth = parseFloat(el.dataset.originalWidth);
            const newWidth = `${originalWidth * (scale / 100)}px`;
            applyResize(el, newWidth, "auto");

            // Optionally resize container
            if (forceResizeContainers) {
                const container = el.parentElement;
                if (container) {
                    storeOriginalDimensions(container);
                    const containerOriginalWidth = parseFloat(container.dataset.originalWidth);
                    const newContainerWidth = `${containerOriginalWidth * (scale / 100)}px`;
                    applyResize(container, newContainerWidth, "auto");
                }
            }
        }

        // Handle <svg> elements
        if (el.tagName.toLowerCase() === "svg" && !ignoreSvg) {
            storeOriginalDimensions(el);

            // Apply new size
            applyResize(el, `${scale}%`, "auto");
        }

        // Handle inline SVGs within <img> tags
        if (isInlineSvg && !ignoreSvg) {
            storeOriginalDimensions(el);

            // Apply new size
            applyResize(el, `${scale}%`, "auto");
        }

        // Handle external SVGs within <img> tags
        if (isExternalSvg && !ignoreSvg) {
            storeOriginalDimensions(el);

            // Apply new size
            applyResize(el, `${scale}%`, "auto");
        }
    });
}

// Function to reset images and SVGs
function resetImages(forceResizeContainers, ignoreSvg) {
    const elements = document.querySelectorAll("img, svg");

    elements.forEach((el) => {
        // Function to reset the element's dimensions
        const resetDimensions = (element) => {
            if (element.dataset.originalWidth) {
                element.style.width = element.dataset.originalWidth;
                element.style.height = element.dataset.originalHeight || "auto";
                delete element.dataset.originalWidth;
                delete element.dataset.originalHeight;
            }
        };

        // Reset standard <img> elements
        if (el.tagName.toLowerCase() === "img" && !isSvgImage(el)) {
            resetDimensions(el);

            // Optionally reset container
            if (forceResizeContainers) {
                const container = el.parentElement;
                if (container && container.dataset.originalWidth) {
                    container.style.width = container.dataset.originalWidth;
                    container.style.height = container.dataset.originalHeight || "auto";
                    delete container.dataset.originalWidth;
                    delete container.dataset.originalHeight;
                }
            }
        }

        // Reset <svg> elements
        if (el.tagName.toLowerCase() === "svg") {
            resetDimensions(el);
            el.removeAttribute("viewBox"); // Clear scaling artifacts
        }

        // Reset inline SVGs within <img> tags
        if (el.tagName.toLowerCase() === "img" && el.src.startsWith("data:image/svg+xml")) {
            resetDimensions(el);
        }

        // Reset external SVGs within <img> tags
        if (isSvgImage(el) && !el.src.startsWith("data:image/svg+xml")) {
            resetDimensions(el);
        }
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'resize') {
        const { scale, forceResize, ignoreSvg } = request.data;
        resizeImages(scale, forceResize, ignoreSvg);
    } else if (request.action === 'reset') {
        const { forceResize, ignoreSvg } = request.data;
        resetImages(forceResize, ignoreSvg);
    }
});

// Observe mutations to handle dynamically added images
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.tagName.toLowerCase() === 'img' || node.tagName.toLowerCase() === 'svg') {
                        // Re-apply current resize settings
                        chrome.storage.local.get(['currentHostname'], (result) => {
                            if (result.currentHostname) {
                                chrome.storage.local.get([result.currentHostname], (hostResult) => {
                                    if (hostResult[result.currentHostname]) {
                                        const { scale, forceResize, ignoreSvg } = hostResult[result.currentHostname];
                                        if (scale) {
                                            resizeImages(scale, forceResize, ignoreSvg);
                                        }
                                    }
                                });
                            }
                        });
                    }
                    // Also check for nested images within added nodes
                    const imgs = node.querySelectorAll && node.querySelectorAll("img, svg");
                    if (imgs && imgs.length > 0) {
                        imgs.forEach((img) => {
                            chrome.storage.local.get(['currentHostname'], (result) => {
                                if (result.currentHostname) {
                                    chrome.storage.local.get([result.currentHostname], (hostResult) => {
                                        if (hostResult[result.currentHostname]) {
                                            const { scale, forceResize, ignoreSvg } = hostResult[result.currentHostname];
                                            if (scale) {
                                                resizeImages(scale, forceResize, ignoreSvg);
                                            }
                                        }
                                    });
                                }
                            });
                        });
                    }
                }
            });
        }
    });
});

// Function to get and store current hostname in storage
function storeCurrentHostname() {
    try {
        const url = new URL(window.location.href);
        const hostname = url.hostname;
        chrome.storage.local.set({ currentHostname: hostname });
    } catch (e) {
        console.error('Invalid URL:', e);
    }
}

// Initial hostname storage
storeCurrentHostname();

// Update hostname storage on URL change
let lastUrl = window.location.href;
window.addEventListener('popstate', () => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        storeCurrentHostname();
    }
});

// Start observing the body for changes
observer.observe(document.body, { childList: true, subtree: true });
