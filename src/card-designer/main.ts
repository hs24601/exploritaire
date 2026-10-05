const canvas = document.querySelector<HTMLCanvasElement>('#designer-canvas');

if (!canvas) {
  throw new Error('Card designer canvas was not found.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('2D context is not available for the card designer canvas.');
}

const image = new Image();
image.src = '/assets/Bluevee.png';

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + clampedRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, clampedRadius);
  ctx.arcTo(x + width, y + height, x, y + height, clampedRadius);
  ctx.arcTo(x, y + height, x, y, clampedRadius);
  ctx.arcTo(x, y, x + width, y, clampedRadius);
  ctx.closePath();
};

const render = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x < width; x += 32) {
    context.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += 32) {
    context.fillRect(0, y, width, 1);
  }

  const frameWidth = Math.min(width * 0.42, 480);
  const frameHeight = frameWidth * 1.4;
  const frameX = (width - frameWidth) / 2;
  const frameY = (height - frameHeight) / 2;
  const frameRadius = Math.min(frameWidth, frameHeight) * 0.05;

  context.fillStyle = 'rgba(12, 18, 32, 0.58)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  context.lineWidth = 1;
  drawRoundedRect(context, frameX, frameY, frameWidth, frameHeight, frameRadius);
  context.fill();
  context.stroke();

  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return;
  }

  const maxImageWidth = frameWidth * 0.82;
  const maxImageHeight = frameHeight * 0.82;
  const scale = Math.min(maxImageWidth / image.naturalWidth, maxImageHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  context.imageSmoothingEnabled = true;
  context.filter = 'brightness(0) saturate(0)';
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.filter = 'none';

  const circleRadius = drawWidth * 0.3;
  const circleX = drawX + drawWidth * 0.5;
  const circleY = drawY + drawHeight * 0.73;

  context.beginPath();
  context.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
  context.strokeStyle = '#3b82ff';
  context.lineWidth = 2;
  context.stroke();
};

image.addEventListener('load', render);
window.addEventListener('resize', render);

render();
