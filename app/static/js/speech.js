(() => {
    const form = document.getElementById('speech-form');
    const input = document.getElementById('speech-text');
    const submit = document.getElementById('speech-submit');
    const status = document.getElementById('speech-status');
    let sending = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (sending) return;

        const text = input.value.trim();
        status.dataset.error = 'false';
        if (!text) {
            status.textContent = 'Enter some text first.';
            status.dataset.error = 'true';
            input.focus();
            return;
        }

        sending = true;
        submit.disabled = true;
        status.textContent = 'Sending…';
        try {
            if (typeof window.sendChat !== 'function') {
                throw new Error('Speech controls are still loading. Please try again.');
            }
            const result = await window.sendChat(text);
            if (!result || result.status !== 'ok') {
                throw new Error('Could not send the text. Please try again.');
            }
            status.textContent = 'Text sent to the robot.';
        } catch (error) {
            status.textContent = error.message;
            status.dataset.error = 'true';
        } finally {
            sending = false;
            submit.disabled = false;
        }
    });
})();
