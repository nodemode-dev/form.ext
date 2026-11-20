import './styles/tokens.css';
import './styles/base.css';
import './styles/scrollbars.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/settings.css';
import { boot } from './shell/shell';
import { loadWindowKey } from './shell/window-key';
import { demoMode, leaveDemo, pageDemo } from './demo/mode';

if (demoMode()) {
  import('./demo/inapp').then(
    (m) => {
      m.install();
      boot();
    },
    () => leaveDemo(),
  );
} else {
  if (!pageDemo()) void loadWindowKey();
  boot();
}
