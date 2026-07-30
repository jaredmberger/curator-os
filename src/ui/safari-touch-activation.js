const INTERACTIVE_SELECTOR = 'a[href], button:not([disabled])';
const MAX_TAP_DISTANCE = 14;
const MAX_TAP_DURATION = 800;

export function installSafariTouchActivation(root) {
  if (!root || !isIpadSafari()) return { destroy() {} };

  let gesture = null;
  let suppressTrustedClick = null;

  const findControl = (target) => {
    const control = target instanceof Element ? target.closest(INTERACTIVE_SELECTOR) : null;
    if (!control || !root.contains(control)) return null;
    // The workspace switch already receives Safari clicks normally. Leave it native.
    if (control.matches('[data-workspace-mode]')) return null;
    return control;
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const touch = event.touches[0];
    const control = findControl(event.target);
    gesture = control ? {
      control,
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      startedAt: performance.now()
    } : null;
  };

  const onTouchMove = (event) => {
    if (!gesture) return;
    const touch = [...event.touches].find((item) => item.identifier === gesture.identifier);
    if (!touch) return;
    if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > MAX_TAP_DISTANCE) gesture = null;
  };

  const onTouchEnd = (event) => {
    if (!gesture) return;
    const completed = gesture;
    gesture = null;

    const touch = [...event.changedTouches].find((item) => item.identifier === completed.identifier);
    if (!touch) return;
    if (performance.now() - completed.startedAt > MAX_TAP_DURATION) return;
    if (Math.hypot(touch.clientX - completed.x, touch.clientY - completed.y) > MAX_TAP_DISTANCE) return;

    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
    const endingControl = findControl(hit);
    if (endingControl !== completed.control) return;

    // Safari is delivering touchstart/touchend to the correct control but is not
    // synthesizing the click that normally follows. Complete the activation from
    // touchend, which is still inside the user's gesture.
    event.preventDefault();
    suppressTrustedClick = { control: completed.control, until: performance.now() + 900 };

    if (completed.control instanceof HTMLAnchorElement) {
      window.location.assign(completed.control.href);
      return;
    }

    completed.control.click();
  };

  const onClickCapture = (event) => {
    if (!suppressTrustedClick || performance.now() > suppressTrustedClick.until) {
      suppressTrustedClick = null;
      return;
    }
    if (event.isTrusted && event.target instanceof Element && suppressTrustedClick.control.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressTrustedClick = null;
    }
  };

  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('click', onClickCapture, true);

  return {
    destroy() {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('click', onClickCapture, true);
    }
  };
}

function isIpadSafari() {
  const ua = navigator.userAgent || '';
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(ua);
  return ipad && safari;
}
