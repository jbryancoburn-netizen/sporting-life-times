/* Sporting Life & Times: center actual crest ink, not the padded source-image rectangle.
 * Preview-only. Applies to historical Big Ten gallery and matching men's/women's mock scorebugs.
 * All artwork stays original and locally served; no network or data pipeline changes.
 */
(() => {
  'use strict';
  const SIDE = 128;
  const MAX_OFFSET = 9;
  const range = (n, a, b) => Math.max(a, Math.min(b, n));

  function percentile(histogram, threshold) {
    let running = 0;
    for (let i = 0; i < histogram.length; i++) {
      running += histogram[i];
      if (running >= threshold) return i;
    }
    return histogram.length - 1;
  }

  function align(img) {
    if (!img.naturalWidth || !img.naturalHeight) {
      img.closest('.crest')?.classList.add('missing');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIDE;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      const scale = Math.min(SIDE / img.naturalWidth, SIDE / img.naturalHeight);
      const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
      context.clearRect(0, 0, SIDE, SIDE);
      context.drawImage(img, (SIDE - width) / 2, (SIDE - height) / 2, width, height);
      const pixels = context.getImageData(0, 0, SIDE, SIDE).data;
      const xCounts = new Uint32Array(SIDE), yCounts = new Uint32Array(SIDE);
      let count = 0, sumX = 0, sumY = 0;
      for (let y = 0; y < SIDE; y++) {
        for (let x = 0; x < SIDE; x++) {
          const i = (y * SIDE + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], alpha = pixels[i + 3];
          // Transparent pixels and white/near-white margins are not logo artwork.
          if (alpha < 96 || (r > 242 && g > 242 && b > 242)) continue;
          xCounts[x]++; yCounts[y]++;
          count++; sumX += x; sumY += y;
        }
      }
      if (count < 25) return;
      // Discard isolated trademarks and anti-aliased flecks that skew the extents.
      const inset = Math.max(1, Math.floor(count * 0.015));
      const xLow = percentile(xCounts, inset);
      const xHigh = percentile(xCounts, count - inset);
      const yLow = percentile(yCounts, inset);
      const yHigh = percentile(yCounts, count - inset);
      // Favor the visible silhouette's center, with its ink centroid as a check.
      const centerX = 0.65 * (xLow + xHigh) / 2 + 0.35 * sumX / count;
      const centerY = 0.65 * (yLow + yHigh) / 2 + 0.35 * sumY / count;
      const offsetX = range((SIDE / 2 - centerX) / SIDE * 100, -MAX_OFFSET, MAX_OFFSET);
      const offsetY = range((SIDE / 2 - centerY) / SIDE * 100, -MAX_OFFSET, MAX_OFFSET);
      img.style.setProperty('--slt-ink-x', offsetX.toFixed(2) + '%');
      img.style.setProperty('--slt-ink-y', offsetY.toFixed(2) + '%');
      img.dataset.opticalAligned = 'true';
    } catch (error) {
      // A source without readable pixels stays centered by the original CSS rule.
      console.warn('Crest alignment fell back to source-box centering:', img.alt, error);
    }
  }

  function init() {
    for (const img of document.querySelectorAll('.crest img')) {
      if (img.complete) align(img);
      else {
        img.addEventListener('load', () => align(img), { once: true });
        img.addEventListener('error', () => img.closest('.crest')?.classList.add('missing'), { once: true });
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
