import './styles/tokens.css';
import './styles/base.css';
import './styles/scrollbars.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/settings.css';
import { boot } from './shell/shell';
import { demoMode, leaveDemo } from './demo/mode';

if (demoMode()) {
  import('./demo/inapp').then(
    (m) => {
      m.install();
      boot();
    },
    () => leaveDemo(),
  );
} else boot();
