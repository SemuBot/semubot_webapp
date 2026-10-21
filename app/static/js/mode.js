// Speech mode toggle: Manual / Local AI / Cloud AI.
// The highlighted button always shows the mode the robot reports (via status polling),
// not just the button that was tapped.
(() => {
    const toggle = document.getElementById('mode-toggle');
    const status = document.getElementById('mode-status');
    if (!toggle || !status) return;
    const buttons = Array.from(toggle.querySelectorAll('button[data-mode]'));
    let pending = null;

    function renderMode(mode) {
        if (pending && pending === mode) pending = null;
        buttons.forEach((button) => {
            button.setAttribute('aria-checked', String(button.dataset.mode === mode));
            button.classList.toggle('pending', button.dataset.mode === pending);
        });
        status.textContent = mode ? '' : '(brain offline)';
    }

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            pending = button.dataset.mode;
            button.classList.add('pending');
            try {
                const resp = await fetch('/api/robot/mode', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({mode: pending})
                });
                const data = await resp.json().catch(() => null);
                if (!resp.ok || !data || data.status !== 'ok') throw new Error('mode change failed');
            } catch (err) {
                console.warn(err);
                pending = null;
                button.classList.remove('pending');
                status.textContent = '(could not change mode)';
            }
        });
    });

    window.renderMode = renderMode;
})();
