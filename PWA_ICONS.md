# PWA Icon Generation

## Generate Icons Online (Recommended)

1. Visit [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload `public/icon.svg` (or your custom logo)
3. Configure settings:
   - iOS: Use "Dedicated picture" for best quality
   - Android: Use "Dedicated picture" and enable maskable support
4. Download the package
5. Extract files to `public/` directory

## Required Files

- `pwa-192x192.png` - 192x192px app icon
- `pwa-512x512.png` - 512x512px app icon  
- `apple-touch-icon.png` - 180x180px iOS icon
- `favicon.ico` - 32x32px favicon

## Alternative: PWA Builder

Visit [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)

1. Upload your base image (icon.svg)
2. Download the generated icon pack
3. Place files in `public/` folder

## Test PWA Installation

### On Android:
1. Open site in Chrome
2. Tap "Add to Home Screen" from menu
3. App icon will appear on home screen

### On iOS:
1. Open site in Safari
2. Tap Share button → "Add to Home Screen"
3. App icon will appear on home screen

## Verify PWA

Use Chrome DevTools > Application > Manifest to verify all icons load correctly
