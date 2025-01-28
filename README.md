# FaceShape.AI 👩💻🧑💻

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/yourusername/FaceShape.AI)

A web-based application that detects face shapes in real-time using computer vision.

![Demo](assets/demo.gif) *(Add a demo GIF later)*

## 🚀 Features
- Real-time face shape detection
- Browser-based (no installations required)
- Privacy-first (processing happens locally)
- Cross-device compatibility

## ⚠️ Opera GX Specific Setup
1. **Enable Browser Flags**  
   `opera://flags` → Enable:
   - `WebGL Draft Extensions`
   - `Override software rendering list`

2. **Disable Built-in Blockers**  
   Click the shield icon → Turn off:
   - Tracker blocker
   - Ad blocker
   - Cryptocurrency Mining Protection

3. **Allow CDN Resources**  
   Add to exceptions in `opera://settings/privacy`:

   
## 🛠️ Installation
```bash
git clone https://github.com/yourusername/FaceShape.AI.git
cd FaceShape.AI
python -m http.server 8000
```

# Model fails to load
- Disable browser extensions
- Check console for blocked CDN requests

# WebGL errors
- Update graphics drivers
- Visit chrome://gpu to verify hardware acceleration


## 🚨 Initial Setup Commands
```bash
# Create new repository
git init
git add .
git commit -m "Initial commit: Real-time face shape detector"
git branch -M main
git remote add origin https://github.com/yourusername/FaceShape.AI.git
git push -u origin main
```
