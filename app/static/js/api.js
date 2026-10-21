// Exposes sendCombined() and sendChat(message) on the global window

// Shared command state so separate controls send a single /move message.
const currentCmd = {
    x: 0.0,
    y: 0.0,
    angular_z: 0.0
};

// Only the combined sender is exported
// and call sendCombined() so the server always receives x, y and angular_z
// together in a single /move message.

// Send a quick-chat message to the server. The server handles the forwarding to the robot
async function sendChat(message) {
    try {
        const resp = await fetch('/api/robot/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message
            })
        });
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        console.log('Chat sent:', message, 'server response:', data);
        return data;
    } catch (err) {
        console.warn(err);
        return null;
    }
}

window.sendChat = sendChat;

// Only one /move request in flight at a time. Calls made meanwhile just mark that the
// latest state must follow, so a stop can never be overtaken by an older move.
let moveInFlight = false;
let movePending = false;

// Send the joystick values to the server. The server handles the forwarding to the robot
async function sendCombined() {
    if (moveInFlight) {
        movePending = true;
        return null;
    }
    moveInFlight = true;
    try {
        // Round values to reduce noise
        const payload = {
            x: Number(currentCmd.x.toFixed(3)),
            y: Number(currentCmd.y.toFixed(3)),
            angular_z: Number((currentCmd.angular_z || 0).toFixed(3))
        };
        const resp = await fetch(`/api/robot/move`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        // Keep console logging for debug
        console.log("Combined send:", payload, "response:", data);
        return data;
    } catch (err) {
        console.error("Failed to send combined command:", err);
        throw err;
    } finally {
        moveInFlight = false;
        if (movePending) {
            movePending = false;
            sendCombined().catch(() => {});
        }
    }
}

// Export combined sender and shared state so other scripts can
// update the command and call sendCombined() as the single source of truth.
window.sendCombined = sendCombined;
window.currentCmd = currentCmd;

async function sendEmergencyStop() {
    try {
        const resp = await fetch(`/api/robot/emergency_stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json().catch(() => null);
        console.log('Emergency stop sent', data);
        return data;
    } catch (err) {
        console.error('Emergency stop failed:', err);
        throw err;
    }
}

window.sendEmergencyStop = sendEmergencyStop;
