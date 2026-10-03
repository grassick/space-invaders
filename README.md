# Headspace Invaders

A cooperative Space Invaders game controlled by horizontal face position. Supports one or two defenders, automatic firing, shared score and five team shields, descending alien waves, individual or joint movement calibration, and inverted controls for projectors.

## Run

Requires Node 20.19+ or 22.12+ and Chrome.

```sh
npm install
npm run dev
```

Open http://localhost:5173 in Chrome on the computer with the webcam. Allow camera access. Other devices need HTTPS to use a camera; an HTTP LAN address is not enough.

1. Choose one or two players, and individual or joint calibration.
2. Enable the camera. Stand far enough back for all faces to remain visible throughout your movement; good front lighting helps.
3. Calibrate: P1 starts on the left of the mirrored camera preview, P2 on the right. Wait for the countdown, then sweep left and right while facing the camera. Individual mode gives each player a separate ten-second sweep. Joint mode gives sixteen seconds for both players to cover shared physical boundaries, taking turns at the edges. Avoid obscuring the other player.
4. Check ship movement; invert if needed. Launch the mission. Ships fire automatically, and both can travel across the entire board.
5. Space or Pause pauses the game. The fullscreen button expands the arena for projection. End mission returns to setup. Keyboard demo uses A/D and left/right arrow keys.

Tracking loss freezes gameplay; it resumes after all faces are visible and steady for about a second. Window focus loss pauses until manually resumed. Changing crew or calibration mode requires recalibration. Calibration is session-only.

## Implementation and limitations

Canvas rendering runs independently of MediaPipe face detection in a classic Web Worker, with at most one camera frame in flight and detection capped near 20 Hz. Camera pixels are processed locally, not stored or uploaded. MediaPipe runtime and model are served locally from `public/`; fonts are fetched from Google Fonts (system fonts work offline). See Google's [Face Detector documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js).

Player association uses position and velocity, not face recognition. Colors may swap if faces overlap, cross, or disappear for a long time. Keep separate physical lanes for reliable identity; both ships can still move across the full game board through individual calibration. If colors swap, end the mission and recalibrate. The short-range detector may struggle with small faces at long distances; test at your intended standing distance. Real webcam accuracy and projector orientation need a live room test.

```sh
npm test
npm run build
npm run preview
```

MediaPipe package assets are copied into `public/vendor` by `npm run setup-assets` (also runs after installation). The bundled BlazeFace short-range model is downloaded from Google's MediaPipe model storage. To refresh it, run `npm run setup-assets` with internet access. Vite includes `public` assets in the production build.

Browser integration checks: with the dev server running, run `node scripts/browser-check.mjs`. Set `CHROME_PATH` if Chrome is not installed at `/opt/google/chrome/chrome`. These checks use a simulated webcam for the real detector pipeline and synthetic face coordinates for calibration and tracking-loss recovery; they do not validate real-world camera accuracy.
