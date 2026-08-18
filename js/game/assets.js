const GAME_ASSET_ROOT = new URL("../../assets/game/", import.meta.url);

export const TRASH_SPRITES = {
  banana: { rect: [0.00, 0.00, 0.29, 0.35], points: 10, label: "banana" },
  can: { rect: [0.28, 0.02, 0.24, 0.34], points: 10, label: "can" },
  bottle: { rect: [0.50, 0.00, 0.25, 0.36], points: 10, label: "bottle" },
  pizza: { rect: [0.72, 0.00, 0.28, 0.37], points: 15, label: "pizza box" },
  apple: { rect: [0.70, 0.30, 0.28, 0.35], points: 10, label: "apple core" },
  paper: { rect: [0.02, 0.66, 0.30, 0.33], points: 5, label: "paper" },
  toxic: { rect: [0.00, 0.29, 0.37, 0.40], hazard: true, label: "toxic bag" },
  fish: { rect: [0.35, 0.31, 0.34, 0.36], hazard: true, label: "dead fish" },
  bricks: { rect: [0.35, 0.67, 0.34, 0.31], hazard: true, label: "bricks" },
  barrel: { rect: [0.70, 0.65, 0.29, 0.34], hazard: true, label: "barrel" },
  bowling: { procedural: true, hazard: true, label: "bowling ball" }
};

const imageUrl = (filename) => new URL(filename, GAME_ASSET_ROOT).href;
const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

const loadImage = (filename) => new Promise((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.addEventListener("load", () => resolve(image), { once: true });
  image.addEventListener("error", () => reject(new Error(`Could not load ${filename}`)), { once: true });
  image.src = imageUrl(filename);
});

const isBackgroundPixel = (data, pixelIndex) => {
  const offset = pixelIndex * 4;
  return Math.max(data[offset], data[offset + 1], data[offset + 2]) < 46;
};

const removeConnectedBlackBackground = (image) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const pixelCount = canvas.width * canvas.height;
  const cleared = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueue = (pixelIndex) => {
    if (cleared[pixelIndex] || !isBackgroundPixel(data, pixelIndex)) {
      return;
    }
    cleared[pixelIndex] = 1;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < canvas.width; x += 1) {
    enqueue(x);
    enqueue((canvas.height - 1) * canvas.width + x);
  }
  for (let y = 1; y < canvas.height - 1; y += 1) {
    enqueue(y * canvas.width);
    enqueue(y * canvas.width + canvas.width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    data[pixelIndex * 4 + 3] = 0;
    const x = pixelIndex % canvas.width;

    if (x > 0) {
      enqueue(pixelIndex - 1);
    }
    if (x < canvas.width - 1) {
      enqueue(pixelIndex + 1);
    }
    if (pixelIndex >= canvas.width) {
      enqueue(pixelIndex - canvas.width);
    }
    if (pixelIndex < pixelCount - canvas.width) {
      enqueue(pixelIndex + canvas.width);
    }
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (cleared[pixelIndex]) {
      continue;
    }
    const x = pixelIndex % canvas.width;
    const touchesBackground =
      (x > 0 && cleared[pixelIndex - 1]) ||
      (x < canvas.width - 1 && cleared[pixelIndex + 1]) ||
      (pixelIndex >= canvas.width && cleared[pixelIndex - canvas.width]) ||
      (pixelIndex < pixelCount - canvas.width && cleared[pixelIndex + canvas.width]);

    if (!touchesBackground) {
      continue;
    }

    const offset = pixelIndex * 4;
    const brightness = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (brightness < 90) {
      data[offset + 3] = Math.round(data[offset + 3] * Math.max(0, (brightness - 35) / 55));
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
};

const trimTransparentImage = (image) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] <= 8) {
        continue;
      }
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return image;
  }

  const padding = 8;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(canvas.width - 1, right + padding);
  bottom = Math.min(canvas.height - 1, bottom + padding);

  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext("2d").drawImage(
    canvas,
    left,
    top,
    trimmed.width,
    trimmed.height,
    0,
    0,
    trimmed.width,
    trimmed.height
  );
  return trimmed;
};

const removeMagentaBackground = (image) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const magenta = Math.min(red, blue);
    const dominance = magenta - green;
    const balance = clamp(1 - Math.max(0, Math.abs(red - blue) - 70) / 100);
    const confidence =
      clamp((dominance - 25) / 80) *
      clamp(magenta / 210) *
      balance;

    if (confidence <= 0.01) {
      continue;
    }

    const foreground = 1 - confidence;
    data[offset + 3] = Math.round(data[offset + 3] * foreground);
    if (foreground > 0.04) {
      data[offset] = clamp((red - confidence * 246) / foreground, 0, 255);
      data[offset + 1] = clamp(green / foreground, 0, 255);
      data[offset + 2] = clamp((blue - confidence * 220) / foreground, 0, 255);
    }
  }

  context.putImageData(imageData, 0, 0);
  return trimTransparentImage(canvas);
};

export const drawImageCover = (context, image, width, height, offsetX = 0) => {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
    sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, sourceX + offsetX));
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  );
};

export const loadGameAssets = async () => {
  const [larrySource, trashSource, truckSource, ...backgrounds] = await Promise.all([
    loadImage("larry-run-sheet.jpg"),
    loadImage("trash-sheet.jpg"),
    loadImage("dumppit-truck-keyed.png"),
    loadImage("street-city.jpg"),
    loadImage("street-alley.jpg"),
    loadImage("street-homes.jpg"),
    loadImage("street-industrial.jpg")
  ]);

  return {
    larrySheet: removeConnectedBlackBackground(larrySource),
    trashSheet: removeConnectedBlackBackground(trashSource),
    truck: removeMagentaBackground(truckSource),
    backgrounds
  };
};
