// Virtual joystick implementation. Depends on window.currentCmd and window.sendCombined exposed by api.js
function initJoystick() {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('knob');
    const status = document.getElementById('status');

    if (!joystick || !knob) return;

    // Interaction states
    let dragging = false;
    let active = false; // Set when the user started an interaction
    let activePointerId = null;
    let activeTouchId = null;
    let lastSent = {
        x: 0,
        y: 0
    };
    let autoSendInterval = null;
    const autoSendMs = 120;

    // Math helpers
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const computeMaxDist = () => (joystick.clientWidth - knob.clientWidth) / 2;

    function scheduleAutoSend() {
        if (autoSendInterval) return;
        autoSendInterval = setInterval(() => {
            if (!dragging || !active) return;
            if (!window.currentCmd || !window.sendCombined) return;
            window.sendCombined().catch(() => {});
        }, autoSendMs);
    }

    function stopAutoSend() {
        if (!autoSendInterval) return;
        clearInterval(autoSendInterval);
        autoSendInterval = null;
    }

    // Send a combined command update
    function sendCombinedUpdate(updater) {
        if (!window.currentCmd || !window.sendCombined) return;
        updater(window.currentCmd);
        try {
            window.sendCombined().catch(() => {});
        } catch (e) {
            /* ignore */
        }
    }

    function updateKnob(clientX, clientY) {
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;

        const maxDist = computeMaxDist();
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
            const scale = maxDist / dist;
            dx *= scale;
            dy *= scale;
        }

        // Scale knob during drag
        const kScale = dragging ? 0.94 : 1.0;
        knob.style.transform = `translate(${dx}px, ${dy}px) scale(${kScale})`;

        // Normalized coordinates: x -1 .. 1, y -1 .. 1
        const nx = clamp(dx / maxDist, -1, 1);
        const ny = clamp(-dy / maxDist, -1, 1);

        if (status) status.textContent = `x: ${nx.toFixed(3)}, y: ${ny.toFixed(3)}`;

        if (!dragging || !active) return;

        // Update current command while dragging
        if (window.currentCmd) {
            window.currentCmd.x = ny;
            window.currentCmd.y = nx;
        }
        scheduleAutoSend();

        // Send only significant motion changes
        const threshold = 0.02;
        if (Math.abs(nx - lastSent.x) > threshold || Math.abs(ny - lastSent.y) > threshold) {
            lastSent.x = nx;
            lastSent.y = ny;
            sendCombinedUpdate((cmd) => {
                cmd.x = nx;
                cmd.y = ny;
            });
        }
    }

    // Animate knob back to center when released
    function resetKnob() {
        knob.style.transition = 'transform 0.12s ease-out';
        knob.style.transform = 'translate(0, 0) scale(1)';
        lastSent = {
            x: 0,
            y: 0
        };
        if (status) status.textContent = 'x: 0.000, y: 0.000';
        stopAutoSend();
        if (active) sendCombinedUpdate((cmd) => {
            cmd.x = 0;
            cmd.y = 0;
        });
        active = false;
        setTimeout(() => {
            knob.style.transition = 'transform 0.06s linear';
        }, 140);
    }

    // Pointer/touch handlers
    function onPointerDown(clientX, clientY) {
        dragging = true;
        active = true;
        updateKnob(clientX, clientY);
    }

    function onPointerMove(clientX, clientY) {
        if (!dragging) return;
        updateKnob(clientX, clientY);
    }

    function onPointerUp() {
        dragging = false;
        resetKnob();
    }

    // Prefer pointer events where available
    joystick.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        try {
            joystick.setPointerCapture(e.pointerId);
        } catch (err) {}
        activePointerId = e.pointerId;
        onPointerDown(e.clientX, e.clientY, e.pointerId);
    });

    joystick.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') return;
        onPointerMove(e.clientX, e.clientY);
    });

    ['pointerup', 'pointercancel'].forEach((ev) => {
        joystick.addEventListener(ev, (e) => {
            try {
                joystick.releasePointerCapture && joystick.releasePointerCapture(e.pointerId);
            } catch (err) {}
            if (activePointerId == null || e.pointerId === activePointerId) {
                activePointerId = null;
                if (e.pointerType !== 'mouse') onPointerUp();
            }
        });
    });

    // Allow drag start from the knob element
    knob.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.pointerType === 'mouse') return;
        joystick.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerId: e.pointerId
        }));
    });

    // Touch fallback when pointer events are unavailable
    joystick.addEventListener('touchstart', (ev) => {
        if (ev.cancelable) ev.preventDefault();
        const r = joystick.getBoundingClientRect();
        for (let i = 0; i < ev.changedTouches.length; i++) {
            const t = ev.changedTouches[i];
            if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
                activeTouchId = t.identifier;
                onPointerDown(t.clientX, t.clientY);
                break;
            }
        }
    }, {
        passive: false
    });
    joystick.addEventListener('touchmove', (ev) => {
        if (ev.cancelable) ev.preventDefault();
        if (activeTouchId == null) return;
        let found = null;
        for (let i = 0; i < ev.touches.length; i++) {
            const t = ev.touches[i];
            if (t.identifier === activeTouchId) {
                found = t;
                break;
            }
        }
        if (found) onPointerMove(found.clientX, found.clientY);
    }, {
        passive: false
    });
    joystick.addEventListener('touchend', (ev) => {
        if (ev.cancelable) ev.preventDefault();
        for (let i = 0; i < ev.changedTouches.length; i++) {
            const t = ev.changedTouches[i];
            if (t.identifier === activeTouchId) {
                activeTouchId = null;
                onPointerUp();
                break;
            }
        }
    });

    // Rotation buttons
    const rotateLeft = document.getElementById('rotate-left');
    const rotateRight = document.getElementById('rotate-right');
    let rotateInterval = null;

    function startRotate(value) {
        sendCombinedUpdate((cmd) => {
            cmd.angular_z = Number(value);
        });
        stopRotate();
        rotateInterval = setInterval(() => sendCombinedUpdate((cmd) => {
            cmd.angular_z = Number(value);
        }), 120);
    }

    function stopRotate() {
        if (rotateInterval) {
            clearInterval(rotateInterval);
            rotateInterval = null;
            sendCombinedUpdate((cmd) => {
                cmd.angular_z = 0;
            });
        }
    }

    // Attach press and hold behavior to a button element
    function addPressHandlers(btn, {
        ignoreMouse = false,
        onPress,
        onRelease
    } = {}) {
        if (!btn) return;
        const pressStart = (e) => {
            if (ignoreMouse && e && e.pointerType === 'mouse') return;
            try {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
            } catch (err) {}
            btn.classList.add('pressed');
            const a = Number(btn.dataset.angle || 0);
            btn.style.transform = `translate(-50%, -50%) rotate(${a - 45}deg) scale(0.92)`;
            if (onPress) onPress(e);
        };
        const pressEnd = (e) => {
            if (ignoreMouse && e && e.pointerType === 'mouse') return;
            try {
                e && e.stopPropagation();
            } catch (err) {}
            btn.classList.remove('pressed');
            const a = Number(btn.dataset.angle || 0);
            btn.style.transform = `translate(-50%, -50%) rotate(${a - 45}deg)`;
            if (onRelease) onRelease(e);
        };

        btn.addEventListener('pointerdown', pressStart);
        ['pointerup', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, pressEnd));
        btn.addEventListener('touchstart', (e) => pressStart(e), {
            passive: false
        });
        btn.addEventListener('touchend', (e) => pressEnd(e), {
            passive: false
        });
        btn.addEventListener('click', (e) => {
            pressStart(e);
            setTimeout(() => pressEnd(e), 150);
        });
    }

    addPressHandlers(rotateLeft, {
        ignoreMouse: true,
        onPress: () => startRotate(-0.6),
        onRelease: stopRotate
    });
    addPressHandlers(rotateRight, {
        ignoreMouse: true,
        onPress: () => startRotate(0.6),
        onRelease: stopRotate
    });

    // Position rotate/chat buttons around the joystick in the wrapper
    function positionRotateButtons() {
        if (!rotateLeft && !rotateRight) return;

        const wrapper = joystick.parentElement && joystick.parentElement.classList && joystick.parentElement.classList.contains('joystick-wrapper') ? joystick.parentElement : null;
        const joystickRect = joystick.getBoundingClientRect();
        const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : joystickRect;
        const w = joystickRect.width;
        const h = joystickRect.height;
        const cx = (joystickRect.left - wrapperRect.left) + w / 2;
        const cy = (joystickRect.top - wrapperRect.top) + h / 2;
        const radius = Math.min(w, h) / 2;

        const knobSize = knob.clientWidth || Math.min(w, h) * 0.3;
        const btnSize = Math.max(36, Math.round(knobSize * 0.95));
        const gap = 12;
        const distance = radius + gap + btnSize / 2;

        const placeLeftAngle = 55;
        const placeRightAngle = 25;

        function place(btn, angleDeg) {
            if (!btn) return;
            const theta = angleDeg * Math.PI / 180;
            const x = cx + distance * Math.cos(theta);
            const y = cy + distance * Math.sin(theta);
            btn.style.width = `${btnSize}px`;
            btn.style.height = `${btnSize}px`;
            btn.style.left = `${x}px`;
            btn.style.top = `${y}px`;
            btn.dataset.angle = String(angleDeg);
            const baseTransform = `translate(-50%, -50%) rotate(${angleDeg - 45}deg)`;
            btn.style.transform = btn.classList.contains('pressed') ? `${baseTransform} scale(0.92)` : baseTransform;
        }

        place(rotateLeft, placeLeftAngle);
        place(rotateRight, placeRightAngle);

        // Position chat button above the right rotate button
        const chatBtn = document.getElementById('chat-btn');
        if (chatBtn) {
            const thetaTarget = placeRightAngle * Math.PI / 180;
            const leftX = cx + distance * Math.cos(thetaTarget);
            const leftY = cy + distance * Math.sin(thetaTarget);

            // Place chat directly above the rotate button by one button height
            const verticalGap = 10; // Pixels between chat and rotate button
            const chatBtnSize = Math.max(28, Math.round(btnSize * 0.72));
            const extraLift = Math.round(btnSize * 0.38);
            const chatX = leftX;
            const chatY = leftY - (btnSize + verticalGap) - extraLift;

            chatBtn.style.width = `${chatBtnSize}px`;
            chatBtn.style.height = `${chatBtnSize}px`;
            chatBtn.style.left = `${chatX}px`;
            chatBtn.style.top = `${chatY}px`;
            chatBtn.dataset.angle = String(placeRightAngle - 90);
            // Keep the same translate centering used by rotate buttons
            chatBtn.style.transform = `translate(-50%, -50%)`;
            chatBtn.style.borderRadius = '12px';
            // Additional quick button placed above the chat button with the same style (functionality to be added later :) )
            const extraBtn = document.getElementById('quick-btn');
            if (extraBtn) {
                const extraGap2 = 8;
                // Make the extra button the same size as the chat button so they visually match
                const extraSize = chatBtnSize;
                const extraY = chatY - (chatBtnSize + extraGap2);
                extraBtn.style.width = `${extraSize}px`;
                extraBtn.style.height = `${extraSize}px`;
                extraBtn.style.left = `${chatX}px`;
                extraBtn.style.top = `${extraY}px`;
                extraBtn.dataset.angle = String(placeRightAngle - 90);
                extraBtn.style.transform = `translate(-50%, -50%)`;
                extraBtn.style.borderRadius = '12px';
            }
        }

        if (wrapper) {
            const btn1x = rotateLeft ? (cx + distance * Math.cos(placeLeftAngle * Math.PI / 180)) : cx;
            const btn2x = rotateRight ? (cx + distance * Math.cos(placeRightAngle * Math.PI / 180)) : cx;
            const rightmostBtnRight = Math.max(btn1x + btnSize / 2, btn2x + btnSize / 2);
            const joystickLeft = cx - radius;
            const leftGap = 12;
            const viewportW = window.innerWidth || document.documentElement.clientWidth;
            const neededWidth = Math.ceil((rightmostBtnRight - joystickLeft) + leftGap * 2);
            // Ensure wrapper height is large enough to contain rotate/chat buttons placed outside the joystick circle so they are not visually clipped
            const extraBottom = Math.round(btnSize + gap + 12); // space below joystick
            const requiredHeight = Math.max(h, h + extraBottom);
            if (neededWidth <= viewportW) {
                const wrapperLeft = leftGap - joystickLeft;
                wrapper.style.width = `${neededWidth}px`;
                wrapper.style.height = `${requiredHeight}px`;
                wrapper.style.marginLeft = `${wrapperLeft}px`;
            } else {
                const smallGap = 8;
                wrapper.style.width = `${viewportW}px`;
                wrapper.style.height = `${requiredHeight}px`;
                const wrapperLeft = smallGap - joystickLeft;
                wrapper.style.marginLeft = `${wrapperLeft}px`;
            }
        }
    }

    positionRotateButtons();

    // Load chat messages from JSON
    async function loadChatMessages() {
        const chatMenu = document.getElementById('chat-menu');
        if (!chatMenu) return;
        const ul = chatMenu.querySelector('.chat-options');
        if (!ul) return;
        try {
            const resp = await fetch('/static/chat_messages.json', {
                cache: 'no-cache'
            });
            if (!resp.ok) throw new Error('Failed to load chat_messages.json');
            const arr = await resp.json();
            if (!Array.isArray(arr)) throw new Error('chat_messages.json invalid format');
            ul.innerHTML = '';
            arr.forEach((txt) => {
                const li = document.createElement('li');
                li.textContent = String(txt);
                li.dataset.msg = String(txt);
                ul.appendChild(li);
            });
        } catch (err) {
            console.warn('Could not load chat_messages.json, using inline items if available.', err);
        }
    }

    // Chat menu behavior
    function setupChatHandlers() {
        const chatBtn = document.getElementById('chat-btn');
        const chatMenu = document.getElementById('chat-menu');
        if (!chatBtn || !chatMenu) return;

        // Prevent accidental immediate re-toggle when closed
        // We set a short ignore window after closing so a following pointerup/click won't reopen the menu
        let ignoreChatToggleUntil = 0;

        function closeMenu() {
            chatMenu.setAttribute('aria-hidden', 'true');
            chatBtn.classList.remove('pressed');
            ignoreChatToggleUntil = Date.now() + 350; // ms
            try {
                document.body.classList.remove('no-scroll');
            } catch (e) {}
        }

        function openMenu() {
            chatMenu.setAttribute('aria-hidden', 'false');
            chatBtn.classList.add('pressed');
            try {
                document.body.classList.add('no-scroll');
            } catch (e) {}
            const cb = chatMenu.querySelector('.chat-close');
            if (cb && cb.focus) cb.focus();
        }

        // Toggle on click/tap
        chatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // ignore clicks that happen immediately after a close to avoid
            if (Date.now() < ignoreChatToggleUntil) return;
            const isOpen = chatMenu.getAttribute('aria-hidden') === 'false';
            if (isOpen) closeMenu();
            else openMenu();
        });

        // Close the menu when tapping outside (backdrop)
        const backdrop = chatMenu.querySelector('.chat-backdrop');
        if (backdrop) {
            backdrop.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                closeMenu();
            });
            backdrop.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                closeMenu();
            });
        }

        // Option click handlers (attach to current items)
        function attachOptionHandlers() {
            const options = chatMenu.querySelectorAll('.chat-options li');
            options.forEach((opt) => {
                // Use pointer events and send on release for tap behavior
                let activePointerId = null;
                let actionSent = false;

                function sendOption() {
                    if (actionSent) return;
                    actionSent = true;
                    const msg = opt.dataset.msg || opt.textContent.trim();
                    if (window.sendChat) window.sendChat(msg).catch(() => {});
                    setTimeout(() => {
                        opt.classList.remove('released');
                        closeMenu();
                    }, 220);
                }

                opt.addEventListener('pointerdown', (e) => {
                    try {
                        e.stopPropagation();
                        e.preventDefault();
                    } catch (err) {}
                    activePointerId = e.pointerId != null ? e.pointerId : 'mouse';
                    try {
                        opt.setPointerCapture && opt.setPointerCapture(e.pointerId);
                    } catch (err) {}
                    opt.classList.add('pressed');
                    actionSent = false;
                });

                opt.addEventListener('pointerup', (e) => {
                    // Only respond to the pointer that started the interaction
                    if (activePointerId != null && e.pointerId != null && e.pointerId !== activePointerId) return;
                    try {
                        e.stopPropagation();
                        e.preventDefault();
                    } catch (err) {}
                    try {
                        opt.releasePointerCapture && opt.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                    activePointerId = null;
                    // Play release animation
                    opt.classList.remove('pressed');
                    opt.classList.add('released');
                    sendOption();
                });

                opt.addEventListener('pointercancel', (e) => {
                    if (activePointerId != null && e.pointerId != null && e.pointerId === activePointerId) {
                        activePointerId = null;
                        opt.classList.remove('pressed');
                    }
                    actionSent = false;
                });

                // Fallback for environments where pointer events aren't available
                opt.addEventListener('click', (e) => {
                    try {
                        e.stopPropagation();
                        e.preventDefault();
                    } catch (err) {}
                    opt.classList.add('released');
                    sendOption();
                });
            });
        }

        // Close button inside menu
        const closeBtn = chatMenu.querySelector('.chat-close');
        if (closeBtn) {
            closeBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                closeMenu();
            });
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                closeMenu();
            });
        }

        // Attach handlers for any options currently in the menu
        attachOptionHandlers();
    }

    // Load messages and then attach handlers and reposition elements to match new sizes
    loadChatMessages().then(() => {
        setupChatHandlers();
        positionRotateButtons();
    }).catch(() => {
        setupChatHandlers();
        positionRotateButtons();
    });
    window.addEventListener('resize', () => {
        positionRotateButtons();
    });

    window.addEventListener('load', () => {
        setTimeout(positionRotateButtons, 30);
    });
}

// Initialize the joystick
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJoystick);
} else {
    setTimeout(initJoystick, 0);
}