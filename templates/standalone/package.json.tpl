{
  "name": "__PROJECT_ID__",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "engines": {"node": ">=24.2.0"},
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "node --test tests/rules.test.ts",
    "check": "npm run build && npm test",
    "inspect": "node scripts/game.ts inspect",
    "scenario": "node scripts/game.ts scenario",
    "replay": "node scripts/game.ts replay",
    "check:browser": "node tests/browser.ts",
    "check:persistence": "node tests/persistence.ts",
    "desktop:setup": "node scripts/desktop.ts setup",
    "desktop:package": "npm run build && node scripts/desktop.ts package",
    "desktop:smoke": "node scripts/desktop.ts smoke"
  },
  "dependencies": {"@thedivineparadox/game-engine": "file:vendor/gyeol-engine.tgz"},
  "devDependencies": {"vite": "8.3.4", "typescript": "7.0.2", "@types/node": "26.6.5", "playwright": "1.64.1"}
}
