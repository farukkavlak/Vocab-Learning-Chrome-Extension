function playVideo() {
    const videoElements = document.querySelectorAll("video");
    if (videoElements.length > 0) {
        videoElements.forEach(function (video) {
            video.play();
        });
    }
}

function pauseVideo() {
    const videoElements = document.querySelectorAll("video");
    if (videoElements.length > 0) {
        videoElements.forEach(function (video) {
            video.pause();
        });
    }
}

function removeButtons() {
    const container = document.getElementById("vocab-container");
    if (container) {
        container.remove();
    }
}

function filterText(text) {
    /**
     *If words contain a number, symbol, skip
     */
    return /\d|[!@#$%^&*(),.?":{}|<>]/.test(text) || text.length < 2;
}

function escKeyHandler(e) {
    if (e.key === "Escape") {
        removeButtons();
        playVideo();
    }
}

function createCustomAlert() {
    window.alert = function (message) {
        var alertBox = document.createElement("div");
        alertBox.id = "boxAlert";
        alertBox.innerHTML = message;
        alertBox.style.fontFamily = "ColfaxAI, Helvetica, sans-serif";
        alertBox.style.borderRadius = "10px";
        alertBox.style.position = "fixed";
        alertBox.style.top = "10px";
        alertBox.style.right = "10px";
        alertBox.style.width = "auto";
        alertBox.style.maxWidth = "30%";
        alertBox.style.backgroundColor = "#fff";
        alertBox.style.border = "1px solid #f5c6cb";
        alertBox.style.padding = "0.75rem 1.25rem";
        alertBox.style.zIndex = "99999999";
        alertBox.style.fontSize = "14px";

        var buttonDiv = document.createElement("div");
        buttonDiv.style.display = "flex";
        buttonDiv.style.justifyContent = "center";
        buttonDiv.style.marginTop = "0.5rem";

        var closeButton = document.createElement("button");
        closeButton.id = "closeButton";
        closeButton.innerText = "X";
        closeButton.style.width = "25px";
        closeButton.style.height = "25px";
        closeButton.style.backgroundColor = "transparent";
        closeButton.style.border = "none";
        closeButton.style.padding = "0.25rem 0.5rem";
        closeButton.style.marginRight = "0.5rem";

        buttonDiv.appendChild(closeButton);
        alertBox.appendChild(buttonDiv);

        closeButton.addEventListener("click", function () {
            alertBox.remove();
            playVideo();
        });
        document.body.appendChild(alertBox);
    };
}

function createButton(text, left, top, width, height, i) {
    const chatChatGptServerUrl = "YOUR_SERVER_URL";
    let button = document.createElement("button");
    button.textContent = text;
    button.style.position = "absolute";
    button.style.left = left;
    button.style.top = top;
    button.style.width = width;
    button.style.height = height;
    button.style.backgroundColor = "#d0451b";
    button.style.borderRadius = "10px";
    button.style.border = "1px solid #942911";
    button.style.color = "#ffffff";
    button.style.fontFamily = "Arial";
    button.style.fontSize = "14px";
    button.style.textDecoration = "none";
    button.style.textShadow = "0px 1px 0px #854629";
    button.style.cursor = "pointer";
    button.style.boxShadow = "inset 0px 1px 0px 0px #cf866c";
    button.style.padding = "2px 2px";
    button.style.fontSize = Math.min(width / 5, height / 3) + "px";
    button.style.display = "flex";
    button.style.justifyContent = "center";
    button.style.alignItems = "center";
    button.style.textAlign = "center";

    button.style.zIndex = 99999999;
    button.id = "button-" + i;
    button.onclick = function () {
        removeButtons();
    };
    button.addEventListener("click", function () {
        removeButtons();
        fetch(chatChatGptServerUrl + text)
            .then(res => res.json())
            .then(result => {
                createCustomAlert();
                chrome.runtime.onMessage.removeListener(arguments.callee);
                alert(result.result);
            })

    });
    return button;
}

document.addEventListener("keydown", escKeyHandler);

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    let buttons = [];
    pauseVideo();

    //Use Google Vision API to get text from image
    const googleVisionApiKey = "YOUR_GOOGLE_VISION_API_KEY";
    const googleVisionUrl = "https://vision.googleapis.com/v1/images:annotate?key=" + googleVisionApiKey;

    const imageData = request.dataUrl.replace("data:image/png;base64,", "");

    const payload = {
        "requests": [
            {
                "image": {
                    "content": imageData
                },
                "features": [
                    {
                        "type": "TEXT_DETECTION"
                    }
                ]
            }
        ]
    };
    const response = await fetch(googleVisionUrl, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
            "Content-Type": "application/json"
        }
    });

    const data = await response.json();
    const textAnnotations = await data.responses[0].textAnnotations;

    const container = document.createElement("div");
    container.style.height = "100vh";
    container.id = "vocab-container";

    for (let i = 1; i < textAnnotations.length; i++) {
        //If words contain a number, symbol or length is less than 2, skip
        if (filterText(textAnnotations[i].description)) {
            continue;
        }
        const text = textAnnotations[i].description;
        const vertices = textAnnotations[i].boundingPoly.vertices;

        const dpr = window.devicePixelRatio || 1;
        const scrollOffset = (window.pageYOffset > 0) ? window.pageYOffset : 0;

        const left = (vertices[0].x / (window.innerWidth * dpr)) * 100 + '%';
        const top = ((vertices[0].y + scrollOffset) / (window.innerHeight * dpr)) * 100 + '%';
        const width = ((vertices[1].x - vertices[0].x) / (window.innerWidth * dpr)) * 100 + '%';
        const height = ((vertices[2].y - vertices[1].y) / (window.innerHeight * dpr)) * 100 + '%';

        const button = createButton(text, left, top, width, height, i);
        container.appendChild(button);
        buttons.push(button);
    }

    document.body.appendChild(container);

    return true;
});
