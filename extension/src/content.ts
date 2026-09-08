interface ScreenshotMessage {
  isScreenshot: boolean;
  dataUrl: string;
}

interface Vertex {
  x: number;
  y: number;
}

interface TextAnnotation {
  description: string;
  boundingPoly: { vertices: Vertex[] };
}

function playVideo(): void {
  document.querySelectorAll("video").forEach((video) => {
    void video.play();
  });
}

function pauseVideo(): void {
  document.querySelectorAll("video").forEach((video) => {
    video.pause();
  });
}

function removeButtons(): void {
  document.getElementById("vocab-container")?.remove();
}

/**
 * If words contain a number, symbol, skip
 */
function filterText(text: string): boolean {
  return /\d|[!@#$%^&*(),.?":{}|<>]/.test(text) || text.length < 2;
}

function escKeyHandler(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    removeButtons();
    playVideo();
  }
}

function createCustomAlert(): void {
  window.alert = (message: string) => {
    const alertBox = document.createElement("div");
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

    const buttonDiv = document.createElement("div");
    buttonDiv.style.display = "flex";
    buttonDiv.style.justifyContent = "center";
    buttonDiv.style.marginTop = "0.5rem";

    const closeButton = document.createElement("button");
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

    closeButton.addEventListener("click", () => {
      alertBox.remove();
      playVideo();
    });
    document.body.appendChild(alertBox);
  };
}

function createButton(
  text: string,
  left: string,
  top: string,
  width: string,
  height: string,
  i: number,
): HTMLButtonElement {
  const chatChatGptServerUrl = "YOUR_SERVER_URL";
  const button = document.createElement("button");
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
  button.style.display = "flex";
  button.style.justifyContent = "center";
  button.style.alignItems = "center";
  button.style.textAlign = "center";
  button.style.zIndex = "99999999";
  button.id = `button-${i}`;

  button.addEventListener("click", () => {
    removeButtons();
    void fetch(`${chatChatGptServerUrl}/?input=${text}`) // "http://localhost:3000/?input=
      .then((res) => res.json())
      .then((result: { result: string }) => {
        createCustomAlert();
        alert(result.result);
      });
  });

  return button;
}

document.addEventListener("keydown", escKeyHandler);

chrome.runtime.onMessage.addListener((request: ScreenshotMessage) => {
  void (async () => {
    pauseVideo();

    // Use Google Vision API to get text from image
    const googleVisionApiKey = "YOUR_GOOGLE_VISION_API_KEY";
    const googleVisionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`;

    const imageData = request.dataUrl.replace("data:image/png;base64,", "");

    const payload = {
      requests: [
        {
          image: { content: imageData },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    };

    const response = await fetch(googleVisionUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const data = (await response.json()) as {
      responses: { textAnnotations: TextAnnotation[] }[];
    };
    const textAnnotations = data.responses[0]?.textAnnotations ?? [];

    const container = document.createElement("div");
    container.style.height = "100vh";
    container.id = "vocab-container";

    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      if (!annotation || filterText(annotation.description)) {
        continue;
      }

      const vertices = annotation.boundingPoly.vertices;
      const [topLeft, topRight, bottomRight] = vertices;
      if (!topLeft || !topRight || !bottomRight) {
        continue;
      }

      const dpr = window.devicePixelRatio || 1;
      const scrollOffset = window.pageYOffset > 0 ? window.pageYOffset : 0;

      const left = `${(topLeft.x / (window.innerWidth * dpr)) * 100}%`;
      const top = `${((topLeft.y + scrollOffset) / (window.innerHeight * dpr)) * 100}%`;
      const width = `${((topRight.x - topLeft.x) / (window.innerWidth * dpr)) * 100}%`;
      const height = `${((bottomRight.y - topRight.y) / (window.innerHeight * dpr)) * 100}%`;

      container.appendChild(
        createButton(annotation.description, left, top, width, height, i),
      );
    }

    document.body.appendChild(container);
  })();

  return true;
});
